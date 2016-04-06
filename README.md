# HANA XSJS queueing and parallel processing

Library that enables queueing and parallel processing in sequential SAP HANA XS JavaScript. To do this it utilises xs job mechanism and queueing.

### Version
0.0.1


## Code Example
```js
var groupid = $.util.createUuid();
    queue.add("test request", groupid);
    queue.add("test request", groupid);
 
 
 var currentStatus = queue.groupStatus(requestData.groupId);
 var results = queue.getGroupResults(requestData.groupId);
```
## Motivation

SAP HANA XS JS it executes code sequentialy. In order to improve the performance parallel processing could be used. This library helps to achieve this. **After SPS 11 there is no need to use this library as NodeJS could be used. It is event-driven and non-blocking by design**.
#### Features
* parallel processing 
* ability to specify the number of paralell processors for a queue
* ability to set timeouts
* ability to retry if timeout/failures (could be useful when calling third parties over http)

## How it works   
One XS Job is constantly looking for arrival of new requests  in the queue. If new requests arrive - new jobs that process those requests are created and immediately executed in parallel. The maximum number of jobs scheduled (threads) is specified in queue parameters.

## Installation

 Some knowledge of scheduling jobs in XS is required.    [Scheduling XS Jobs](https://help.sap.com/saphelp_hanaplatform/helpdata/en/44/5b9667c4aa4a7b9a17b9b45eacb435/content.htm?frameset=/en/62/15446213334d9fa96c662c18fb66f7/frameset.htm&current_toc=/en/34/29fc63a1de4cd6876ea211dc86ee54/plain.htm&node_id=339&show_children=false)

1. Copy Queueing package in your project.
2. Setting  up queue table.  
Queue table definition could be found in `TestQueue.hdbdd` file.
 
    ```sh
    Entity TestQueue { 
        key ID : String(32); //guid; 
   GROUP_ID : String(32); //guid
   STATUS : hana.TINYINT;
   REQUEST : LargeString;
   RESPONSE : LargeString;
   ADDED_AT : UTCDateTime;
   STARTED_AT : UTCDateTime;
   FINISHED_AT : UTCDateTime;
   ERROR : LargeString;
        RETRY : hana.TINYINT not null default 0;
    };       
   ```


2. Seting up jobs.  
    Two jobs should be created and activated (examples from test folder could be used) 
    - queueProcessor - this job doe snot have any schedules, schedules are added programatically by library.
        ```sh
         "action": "sap.translsvc.libs.Queueing.tests:TestQueueProcessor.xsjs::process"
         ```
    - queueWatcher  - watches queue and process items when they appear there
        ```sh
            "action": "sap.translsvc.libs.Queueing.tests:TestQueueProcessor.xsjs::watch"
            
            "schedules": [{
            "description": "monitors Queue for the new items ",
            "xscron": "* * * * * * 0:59/1"
                  }] 
3. Setting up Queue processor.  
    .xsjs file that processes Queue should be created and have two methods and queue initialisation:
    
    ```sh
    var queuelib = $.import("<path to queue lib>", "Queue");

    var options = {
           queueTableName: '<table name>',
              maxQueueProcessors: 4, 
              maxExecutionCount : 4,
              jobProcessorName : "Queueing.tests::TestQueueProcessor",
              jobWatcherName : "Queueing.tests::TestQueueWatcher"
              };
     var queue = new queuelib.Queue(options);

    //watching queue 
    function watch()  { queue.watch(); } 
    
    queue.process(function(request){ 
        //some (long running) code to process request 
        return "request " +  request + "  was processed";
    });
    ```   
4. Permissions.  
    User that executes jobs should have 
    - `sap.hana.xs.admin.roles::JobAdministrator` role   
    be able to access:
    - `"_SYS_XS"."JOB_LOG"` table create/update/delete
    - `"_SYS_XS"."JOB_SCHEDULES"`  table create/update/delete
    


## API Reference
Queue options:
```js
var options = {
           queueTableName: '<table name>',
              maxQueueProcessors: 4,
              maxExecutionCount : 4, 
              jobProcessorName : "Queueing.tests::TestQueueProcessor",
              jobWatcherName : "Queueing.tests::TestQueueWatcher"
              };
     var queue = new queuelib.Queue(options);
```

### options
* `queueTableName` name of the table where items are queued
* `maxQueueProcessors` how many threads should be used to proccess the queue  
* `maxExecutionCount` how many items one thread could process sequentioaly 
* `jobProcessorName`and `jobProcessorName` uri of corresponding jobs


Queueing items to process:
```js
var groupid = $.util.createUuid();
    //add items in queue to process
    queue.add("test request", groupid);
    queue.add("test request", groupid);
    
    //wait till both items are processed
    var results = queue.waitGroupToFinish(groupid);
```
Processing items. Processor.xsjs code:
    
 ```js
    queue.process(function(request){ // test request
        //code to process request and return result          
     return "request " +  request + "  was processed";
    });
```



## Tests

Test could be found under `Queueing/tests` folder 


## Todos
 - add priority
