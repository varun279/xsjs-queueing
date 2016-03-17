var sql = $.import("sap.translsvc.libs", "sql");
var jobHelper = $.import("sap.translsvc.libs.Queueing", "JobHelper");

//todo add timeout done
//todo add jobs programattically? not sure

//todo return errors second param
//todo priority

var Queue = (function() {

	var Status = {
		added: 0,
		started: 1,
		finished: 2,
		error: 3,

		getValue: function(value) {
			return Object.keys(Status)[value];
		}
	};


	Object.defineProperty(Error.prototype, 'toJSON', {
		value: function() {
			var alt = {};

			Object.getOwnPropertyNames(this).forEach(function(key) {
				alt[key] = this[key];
			}, this);

			return alt;
		},
		configurable: true
	});

    function getString(obj)
    {
        if (obj == null) return null;
        else if (typeof  obj == 'string')
        return obj;
        else return  $.util.stringify(obj);
        
    }
	function parseRow(row) {

		return {
			request: getString(row.REQUEST),
			response: getString(row.RESPONSE),
			id: row.ID,
			statusString: Status.getValue(row.STATUS),
			status: row.STATUS,
			error: getString(row.ERROR),
			retry : row.RETRY

		};
	}

	function Queue(queueOptions) {
		this.options = queueOptions;
		
		
        var jobPath = "/" + this.options.jobProcessorName.replace(".","/").replace("::", "/") + ".xsjob";		             	
		this.options.job =   $.jobs.Job({uri:	"/sap/translsvc/xsServices/STH/TO/TranslationQueueProcessor.xsjob"});
		jobHelper.init(this.options);
		
 
		
	}

	Queue.prototype.Status = Status;

	//add item in queue
	Queue.prototype.add = function(request, groupId) {

		if (groupId === undefined) groupId = $.util.createUuid();

		var id = $.util.createUuid();
		
		var connection = $.hdb.getConnection();
		

		connection.executeUpdate('insert into  ' + this.options.queueTableName + ' (ID, GROUP_ID, ADDED_AT, REQUEST, STATUS) values(?,?,?,?,?)',
			id,
			groupId,
			new Date(),
			request,
			Status.added);
			
		connection.commit();
		
		
// 		connection.executeInsertFromObject(this.options.queueTableName, {
// 			ID: id,
// 			GROUP_ID: groupId,
// 			ADDED_AT: new Date(),
// 			REQUEST: request,
// 			STATUS: Status.added

// 		});

		return id;
	};

	//mark as finished
	Queue.prototype.finish = function(id, response) {

		if (response === undefined) response = null;

		var connection = $.hdb.getConnection();
		connection.executeUpdate('update  ' + this.options.queueTableName + 'set STATUS = ?, FINISHED_AT = ?, RESPONSE = ? where ID = ?',
			Status.finished,
			new Date(), response, id);
			
		connection.commit();
	};

	Queue.prototype.finishWithException = function(id, error) {
		var connection = $.hdb.getConnection();
		connection.executeUpdate('update  ' + this.options.queueTableName + 'set STATUS = ?, FINISHED_AT = ?, ERROR = ? where ID = ?', Status.error,
			new Date(), error, id);
		connection.commit();
	};

    //todo call from separate job 
	Queue.prototype.checkTimeout = function() {

		if (this.options.timeout === undefined) {
			return;
		}
		
	  var connection = $.hdb.getConnection();
	
	 //retry if timeout expired 
	  if (this.options.maxRetryAttempts !== undefined && this.options.maxRetryAttempts > 0) {
	      
		connection.executeUpdate('update  ' + this.options.queueTableName +
			'set status = 0,  started_at = ?, finished_at = null, retry = retry + 1  where status = 1 and  SECONDS_BETWEEN(started_at, ?) > ?  and retry < ?',
			new Date(),
			new Date(),
			this.options.timeout,
			this.options.maxRetryAttempts
		);
		
			connection.commit();
	      
	  }
		//set timeout expired
		connection.executeUpdate('update  ' + this.options.queueTableName +
			'set status = 3, error = ? where status = 1 and  SECONDS_BETWEEN(started_at, ?) > ? ', 
			"timeout expired",
			new Date(),
			this.options.timeout + 2
		);
		
		
		connection.commit();
	};

	Queue.prototype.getQueuedItembyId = function(id) {

		var connection = $.hdb.getConnection();

		var rs = connection.executeQuery('select *  from  ' + this.options.queueTableName + ' where id = ?', id);

		if (rs[0] === undefined) {
			return null;
		}

		var row = rs[0];

		return parseRow(row);
	};

	Queue.prototype.getCurrentlyRunning = function() {

		var connection = $.hdb.getConnection();

		var rs = connection.executeQuery('select count(*) cnt from  ' + this.options.queueTableName + ' where STATUS = 1');

		return (Math.round(rs[0].CNT.toString()));
	};
	
	//delete old job logs and schedules - move to job helper
	Queue.prototype.deleteOldJobArtifacts = function() {

        jobHelper.deleteJobArtifactsOlderThen(1, this.options.jobProcessorName);
        jobHelper.deleteJobArtifactsOlderThen(1, this.options.jobWatcherName);
	
	};

	//get first not processed item from queue todo take where less items first
	Queue.prototype.getFirstAndMarkStarted = function() {

		var connection = $.hdb.getConnection();
		
		//var query = 'select top 1 *  from  ' + this.options.queueTableName + ' where STATUS = 0';
		
		
		var getFirstItemThatHasLessBatchSizeAndApplyLittleRandomization = 'select top 1 t.*, priorityOrder from  ' + this.options.queueTableName + '  t ' + 
                    ' inner join ( ' +
                    ' select group_id, count(*) * rand() as priorityOrder from  ' + this.options.queueTableName + ' where status = 0 group by group_id) g on t.group_id = g.group_id ' +
                    ' where status = 0 order by priorityOrder';


		var rs = connection.executeQuery(getFirstItemThatHasLessBatchSizeAndApplyLittleRandomization);

		if (rs[0] === undefined) return null;

		connection.executeUpdate('update  ' + this.options.queueTableName + 'set STATUS = ?, STARTED_AT = ?  where ID = ?', 
		Status.started,
		new Date(),
		rs[0].ID);
		connection.commit();

		return parseRow(rs[0]);
	};

	//wait till all items with particular GROUP_ID will be processed 
	Queue.prototype.waitGroupToFinish = function(groupId) {

		var connection = $.hdb.getConnection();
		var runningExists = true;

		while (runningExists) ////todo delay
		{
			var rs = connection.executeQuery('select count(*)  "cnt" from  ' + this.options.queueTableName +
				' where  GROUP_ID = ? and (STATUS = 0 or STATUS = 1) ', groupId);
			runningExists = rs[0].cnt > 0;

		}

		rs = connection.executeQuery('select * from  ' + this.options.queueTableName + ' where GROUP_ID = ?', groupId);

		return Object.keys(rs).map(function(row) {
			return parseRow(rs[row]);

		});

	};

	Queue.prototype.getQueueLength = function() {

		var connection = $.hdb.getConnection();
		var rs = connection.executeQuery('select count(*)  "cnt" from  ' + this.options.queueTableName + ' where STATUS = 0');
		return rs[0].cnt;

	};

	//watch queue and spin new threads if items to process are found in queue
	Queue.prototype.watch = function() {

		try {

			var qLength = this.getQueueLength();

			if (this.getQueueLength() > 0) {

				var currentlyrunningThreadsCount = this.getCurrentlyRunning(); //jobHelper.getRunningQueueProcessors().length;

				if (currentlyrunningThreadsCount < this.options.maxQueueProcessors) {

					var processesToSpin = Math.min(qLength, this.options.maxQueueProcessors - currentlyrunningThreadsCount);

					for (var c = 0; c < processesToSpin; c++) {
						jobHelper.addProcessor();
					}

				}
			}
			
		//	this.checkTimeout();
		//	this.deleteOldJobArtifacts();
			
		} catch (err) {

			$.trace.error('job watch  ' + JSON.stringify(err));

		}

	};
	
		//watch queue and spin new threads if items to process are found in queue
	Queue.prototype.maintenance = function() {

		try {
			this.checkTimeout();
			this.deleteOldJobArtifacts();
			
		} catch (err) {

			$.trace.error('job watch  ' + JSON.stringify(err));

		}

	};
	

	Queue.prototype.process = function(funcToParalelize) {
//return;
		var currentExecution = 0;

		do {
			var res = this.getFirstAndMarkStarted();

			currentExecution++;

			if (res !== null) {

				try {

					var result = funcToParalelize(res.request);

					this.finish(res.id, result);

				} catch (err) {

					this.finishWithException(res.ID, JSON.stringify(err));

				}
			}

		}

		while (res !== null || currentExecution < this.options.maxExecutionCount);
	};

	Object.defineProperty(Queue, 'options', {
		get: function() {
			return this.options;
		},
		//set: function(newValue) { bValue = newValue; },
		enumerable: true,
		configurable: true
	});

	return Queue;
})();