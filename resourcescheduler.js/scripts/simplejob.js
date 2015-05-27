function continueSimpleJob(resource, jobContext) {
    nextQueryInJob(resource, jobContext, continueSimpleJob);
}