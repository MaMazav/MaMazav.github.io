function continueSimpleJob(resource, jobContext, callbacks) {
    nextQueryInJob(resource, jobContext, callbacks).then(function(isDone) {
        if (isDone !== 'done') {
            continueSimpleJob(resource, jobContext, callbacks)
        }
    });
}