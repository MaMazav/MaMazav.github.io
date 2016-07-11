function continueYieldableJob(resource, jobContext) {
    if (!scheduler.shouldYieldOrAbort(jobContext)) {
        nextQueryInYieldableJob(resource, jobContext);
        return;
    }
    
    // Simulate release time
    setTimeout(function() {
        var isYielded = scheduler.tryYield(
            /*continueJob=*/nextQueryInYieldableJob,
            jobContext,
            jobAborted,
            jobYielded,
            resource);
        
        if (!isYielded) {
            nextQueryInYieldableJob(resource, jobContext);
        }
    }, 30);
}

function nextQueryInYieldableJob(resource, jobContext) {
    nextQueryInJob(resource, jobContext).then(function(isDone) {
        if (isDone !== 'done') {
            continueYieldableJob(resource, jobContext);
        }
    });
}

function jobYielded(jobContext) {
    console.log('Job ' + jobContext.id + ' has been yielded, remaining queries: ' + (jobContext.numQueries - jobContext.performedQueries));
}