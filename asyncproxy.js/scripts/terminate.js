'use strict';

var TerminateProxy = (function TerminateProxyClosure() {
    function TerminateProxy() {
        var scriptsToImport = [
            AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js',
            AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/subworkerproxy.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    TerminateProxy.prototype.callSubWorker = function callSubWorker(depth) {
        var args = [depth];
        this._workerHelper.callFunction('callSubWorker', args);
    };
    
    TerminateProxy.prototype.releaseResources = function releaseResources() {
        var args = [];
        var promise = this._workerHelper.callFunction('releaseResources', args, { isReturnPromise: true });
        
        var workerHelper = this._workerHelper;
        return promise.then(function() {
            workerHelper.terminate();
        });
    };
    
    return TerminateProxy;
})();