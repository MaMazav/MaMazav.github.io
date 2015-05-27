function continueYieldableJob(resource, jobContext) {
    var isYielded = scheduler.tryYield(
        /*continueJob=*/nextQueryInYieldableJob,
        jobContext,
        jobAborted,
        jobYielded);
    
    if (!isYielded) {
        nextQueryInYieldableJob(resource, jobContext);
    }
}

function nextQueryInYieldableJob(resource, jobContext) {
    performNextQueryInJob(resource, jobContext, continueYieldableJob);
}

function jobYielded(jobContext) {
    console.log('Job ' + jobContext.id + ' has been yielded, remaining queries: ' + jobContext.numQueries - jobContext.performedQueries);
}