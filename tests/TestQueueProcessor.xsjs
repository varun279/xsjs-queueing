var queuelib = $.import("sap.translsvc.libs.Queueing", "Queue");


 var options = {
	queueTableName: '"SAP_HANA_TEST"."sap.translsvc.libs.Queueing.tests::TestQueue"',
             	maxQueueProcessors: 1, 
             	maxExecutionCount : 4,
             	jobProcessorName : "sap.translsvc.libs.Queueing.tests::TestQueueProcessor",
             	jobWatcherName : "sap.translsvc.libs.Queueing.tests::TestQueueWatcher"
       
 };
 
var queue = new queuelib.Queue(options);



//watching queue 
function watch() 
 {
 	queue.watch();
 } 


queue.process(function(request){ 
    //code to process request        	    
     return "request " +  request + "  was processed";
});
        