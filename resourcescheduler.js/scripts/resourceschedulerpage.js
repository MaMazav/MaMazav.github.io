'use strict';

var newJobsIntervalHandle;
var demoState = 'idle';
var activeJobs = 0;
var jobsCounter = 0;

function onDemoButton() {
    var demoButton = document.getElementById('demoButton');
    if (demoState === 'idle') {
        startSchedulingDemo();
        demoButton.value = 'Stop demo';
    } else if (demoState === 'run') {
        stopSchedulingDemo();
        demoButton.value = 'Start demo!';
    } else {
        alert('Please wait. Demo is still running');
    }
}

function startSchedulingDemo() {
    var newJobEveryMs = +document.getElementById('newJobEveryMs').value;
    var maxNumQueriesPerJob = +document.getElementById('maxNumQueriesPerJob').value;
    var jobsLimit = +document.getElementById('jobsLimit').value;
    var numNewJobs = +document.getElementById('numNewJobs').value;
    var numJobsBeforeRerankOldPriorities = +document.getElementById('numJobsBeforeRerankOldPriorities').value;
    var resourcesGuaranteedForHighPriority = +document.getElementById('resourcesGuaranteedForHighPriority').value;
    var highPriorityToGuaranteeResource = +document.getElementById('highPriorityToGuaranteeResource').value;
    var useYield = Boolean(document.getElementById('useYield').checked);
    
    activeJobs = 0;
    jobsCounter = 0;
    demoState = 'run';
    
    initializeScheduling(
        jobsLimit,
        numNewJobs,
        numJobsBeforeRerankOldPriorities,
        resourcesGuaranteedForHighPriority ,
        highPriorityToGuaranteeResource);

    newJobsIntervalHandle = setInterval(function createNewJob() {
        ++activeJobs;
        var id = ++jobsCounter;
        var numQueries = id % maxNumQueriesPerJob;
        
        console.log('Starting job ' + id + ' with ' + numQueries + ' queries to perform');
        
        createJob(id, numQueries, useYield, finishedSingleJobCallback);
    }, newJobEveryMs);
}

function stopSchedulingDemo() {
    demoState = 'waitEnd';
    clearInterval(newJobsIntervalHandle);
    endScheduling();
    
    if (activeJobs === 0) {
        schedulingStoppedCallback();
    }
}

function finishedSingleJobCallback(err, result, id) {
    --activeJobs;
    if (err) {
        console.log('Job ' + id + ' has been terminated:' + err);
    } else {
        console.log('Job ' + id + ' has been successfully terminated');
    }
    
    if (demoState === 'waitEnd' && activeJobs === 0) {
        schedulingStoppedCallback();
    }
}

function schedulingStoppedCallback() {
    demoState = 'idle';
    console.log('----------Demo ended----------');
}