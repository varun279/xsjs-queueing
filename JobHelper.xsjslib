var options;

function init(queueOptions) {
	options = queueOptions;
}



var deleteJobArtifactsOlderThen = function(hours, jobName)
{
    
    	var connection = $.hdb.getConnection();
    	
    
    	connection.executeUpdate('delete from "_SYS_XS"."JOB_LOG" where  SECONDS_BETWEEN(started_at, current_timestamp) > ?  and action like ' + "'" + jobName.replace("::", ":") + '%' + "'", 60 * 60 * hours);
    
    	connection.executeUpdate('delete from "_SYS_XS"."JOB_SCHEDULES" where  SECONDS_BETWEEN(changed_at, current_timestamp) > ?  and  job_name = '  + "'" + jobName +   "'" , 60 * 60 * hours);
    
    	connection.commit();
    	
};

function timeToCron() {
	//xscron format:  Year Month Day DayofWeek Hour Minute Second 
	var week = {
		1: "mon",
		2: "tue",
		3: "wed",
		4: "thu",
		5: "fri",
		6: "sat",
		0: "sun"
	};

	var date = new Date();
	date.setSeconds(date.getSeconds() + 1);

	var month = date.getMonth() + 1;
	return date.getFullYear() + " " + month + " " + date.getDate() + " " + week[date.getDay()] + " " + date.getHours() + " " + date.getMinutes() +
		" " + date.getSeconds();
 
}

function addProcessor() {

	var xsCronInstantaneous = timeToCron();

	var thread = options.job;

    thread.schedules.add({
		description: "adding schedule",
		xscron: xsCronInstantaneous

	});

}

function deleteAllSchedules() {

	var thread = options.job;

	Object.keys(thread.schedules).forEach(function(scheduleid) {
		thread.schedules.delete({
			id: Number(scheduleid)
		});

	});

}