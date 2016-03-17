var queuelib = $.import("sap.translsvc.libs.Queueing", "Queue");

describe("DomainService E2E Test", function() {

	var queue;
	

	beforeOnce(function() {


		var options = {
			queueTableName: '"SAP_HANA_TEST"."sap.translsvc.libs.Queueing.tests::TestQueue"',
             	maxQueueProcessors: 1, 
             	maxExecutionCount : 4,
             	jobProcessorName : "sap.translsvc.libs.Queueing.tests::TestQueueProcessor",
             	jobWatcherName : "sap.translsvc.libs.Queueing.tests::TestQueueWatcher"
        
		};

		queue = new queuelib.Queue(options);
	});

	it("can add item in queue", function() {

  
    		var itemid = queue.add("test request");
    
    		var result = queue.getQueuedItembyId(itemid);
    
    		expect(result.request).toBe("test request");
    		expect(result.status).toBe(queue.Status.added);

	});

	it("can set item to finished", function() {

    		var itemid = queue.add("test request");
    
    		var result = queue.getQueuedItembyId(itemid);
    
    		expect(result.request).toBe("test request");

	});
	
		it("can get currently running", function() {

    		var result = queue.getCurrentlyRunning();
    
    		expect(result).toBe(0);

	});
	
	
	it("can process item", function() {

        	var itemid = queue.add("request data");
            
        	queue.process(function(request){ 
        	    
        	    return "request " +  request + "  was processed";
        	});
        
            var result = queue.getQueuedItembyId(itemid);
        	expect(result.status = queue.Status.finished );
        	expect(result.response.length).toBeGreaterThan(0);

	});
	
	it("can process two items and wait to finish", function() {


            var groupid = $.util.createUuid();
            
   
        	queue.add("0 test request", groupid);
        	queue.add("1 test request", groupid);
            
        	queue.process(function(request){ 
        	    
        	    return "request " +  request + "  was processed";
        	});
        
            var results = queue.waitGroupToFinish(groupid);
            
  
        	expect(results.length).toBe(2);


	});
	

	it("can retry item ", function() {

        	var itemid = queue.add("request data");
            queue.options.timeout = -1;
            queue.options.maxRetryAttempts = 2;
            
            queue.getFirstAndMarkStarted();
        	queue.checkTimeout();
        	queue.getFirstAndMarkStarted();
        	queue.checkTimeout();
        	queue.getFirstAndMarkStarted();
        	queue.checkTimeout();
        	queue.getFirstAndMarkStarted();
        	queue.checkTimeout();
        
            var result = queue.getQueuedItembyId(itemid);
        	expect(result.status = queue.Status.error );
        	expect(result.retry).toBe(2);
        	expect(result.error).toBe("timeout expired");
        

	});
	
	it("can timeout item", function() {

        	var itemid = queue.add("request data");
            queue.options.timeout = -1;
            queue.options.maxRetryAttempts = 0;
             
            queue.getFirstAndMarkStarted();
        	queue.checkTimeout();
        
            var result = queue.getQueuedItembyId(itemid);
        	expect(result.status = queue.Status.error );
        	expect(result.error).toBe("timeout expired");
        

	});
	
	
	//disable
		xit("can process items using job", function() {


            var groupid = $.util.createUuid();
            
   
        	queue.add("0 test request", groupid);
        	queue.add("1 test request", groupid);
            
        
            var results = queue.waitGroupToFinish(groupid);
            
  
        	expect(results.length).toBe(2);


	});

});