function createDbConnectionResource() {
    return {
        performQuery: function performQuery(sql) {
            return new Promise(function(resolve, reject) {
                // Simulate query
                
                setTimeout(querySimulationEnded, 1000);
                
                function querySimulationEnded() {
                    resolve('Dummy result');
                }
            });
        }
    };
}

var prioritizer = {
    getPriority: function getPriority(jobContext) {
        if (prioritizer.abortAllJobs) {
            return -1;
        }
        
        // As much queries remaining for the job to perform, as higher the job's priority
        return jobContext.numQueries - jobContext.performedQueries;
    }
};