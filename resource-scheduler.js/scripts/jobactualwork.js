function nextQueryInJob(resource, jobContext, callbacks) {
    var dbConnection = resource;
    
    ++jobContext.performedQueries;
    var sql = 'Select * from Table' + jobContext.performedQueries;
    
    console.log('Job ' + jobContext.id + ' performs query, remaining queries: ' + (jobContext.numQueries - jobContext.performedQueries));
    
    return dbConnection.performQuery(sql).then(function resultCallback(result) {
        jobContext.results.push(result);
        if (jobContext.performedQueries < jobContext.numQueries) {
            return 'not-done';
        }
        
        callbacks.jobDone();
        jobContext.finishedJobCallback(null, jobContext.results, jobContext.id);
        return 'done';
    });
}