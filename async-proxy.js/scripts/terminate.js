'use strict';

var TerminateProxy = asyncProxy.AsyncProxyFactory.create(
    [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js',
     asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/sub-worker-proxy.js'],
    'Callee',
    { 'callSubWorker': [] })

TerminateProxy.prototype.releaseResources = function() {
    var workerHelper = asyncProxy.AsyncProxyFactory.getWorkerHelper(this);
    var args = [];
    var promise = workerHelper.callFunction('releaseResources', args, { isReturnPromise: true });
    
    return promise.then(function() {
        workerHelper.terminate();
    });
};