function createDbConnectionResource() {
    return {
        performQuery: function performQuery(sql, callback) {
            // Simulate query
            
            setTimeout(querySimulationEnded, 1000);
            
            function querySimulationEnded() {
                callback('Dummy result');
            }
        }
    };
}

var prioritizer = {
    getPriority: function getPriority(jobContext) {
        if (prioritizer.abortAllJobs) {
            return -1;
        }
        
        // As much queries the job has performed, as higher the job's priority
        return jobContext.numQueries - jobContext.performedQueries;
    }
};