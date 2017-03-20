function continueYieldableJob(resource, jobContext, callbacks) {
    if (!callbacks.shouldYieldOrAbort()) {
        nextQueryInYieldableJob(resource, jobContext, callbacks);
        return;
    }
    
    // Simulate release time
    setTimeout(function() {
        var isYielded = callbacks.tryYield(
            /*continueJob=*/nextQueryInYieldableJob,
            jobAborted,
            jobYielded);
        
        if (!isYielded) {
            nextQueryInYieldableJob(resource, jobContext, callbacks);
        }
    }, 30);
}

function nextQueryInYieldableJob(resource, jobContext, callbacks) {
    nextQueryInJob(resource, jobContext, callbacks).then(function(isDone) {
        if (isDone !== 'done') {
            continueYieldableJob(resource, jobContext, callbacks);
        }
    });
}

function jobYielded(jobContext) {
    console.log('Job ' + jobContext.id + ' has been yielded, remaining queries: ' + (jobContext.numQueries - jobContext.performedQueries));
}