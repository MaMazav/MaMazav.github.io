function continueSimpleJob(resource, jobContext) {
    nextQueryInJob(resource, jobContext).then(function(isDone) {
        if (isDone !== 'done') {
            continueSimpleJob(resource, jobContext)
        }
    });
}