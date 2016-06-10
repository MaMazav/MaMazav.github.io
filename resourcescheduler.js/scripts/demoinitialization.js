var scheduler;

function initializeScheduling(
    jobsLimit,
    numNewJobs,
    numJobsBeforeRerankOldPriorities,
    resourcesGuaranteedForHighPriority ,
    highPriorityToGuaranteeResource) {
    
    prioritizer.abortAllJobs = false;
    
    scheduler = new ResourceScheduler.PriorityScheduler(
        createDbConnectionResource, jobsLimit, prioritizer, {
            numNewJobs: numNewJobs,
            numJobsBeforeRerankOldPriorities: numJobsBeforeRerankOldPriorities,
            resourcesGuaranteedForHighPriority: resourcesGuaranteedForHighPriority,
            highPriorityToGuaranteeResource: highPriorityToGuaranteeResource
    });
}

function createJob(id, numQueries, useYield, finishedJobCallback) {
    var jobFunc = useYield ? continueYieldableJob : continueSimpleJob;
    
    var jobContext = {
        performedQueries: 0,
        numQueries: numQueries,
        results: [],
        finishedJobCallback: finishedJobCallback,
        id: id
    };
    
    scheduler.enqueueJob(jobFunc, jobContext, jobAborted);
}

function endScheduling() {
    prioritizer.abortAllJobs = true;
}

function jobAborted(jobContext) {
    jobContext.finishedJobCallback('Job was aborted', null, jobContext.id);
}