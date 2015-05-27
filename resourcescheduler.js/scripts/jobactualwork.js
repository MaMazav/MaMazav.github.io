function nextQueryInJob(resource, jobContext, nextQueryCallback) {
    if (jobContext.performedQueries >= jobContext.numQueries) {
        scheduler.jobDone(resource, jobContext);
        
        jobContext.finishedJobCallback(null, jobContext.results, jobContext.id);
        return;
    }

    var dbConnection = resource;
    
    ++jobContext.performedQueries;
    var sql = 'Select * from Table' + jobContext.performedQueries;
    
    console.log('Job ' + jobContext.id + ' performs query, remaining queries: ' + (jobContext.numQueries - jobContext.performedQueries));
    
    dbConnection.performQuery(sql, function resultCallback(result) {
        jobContext.results.push(result);
        nextQueryCallback(resource, jobContext);
    });
}