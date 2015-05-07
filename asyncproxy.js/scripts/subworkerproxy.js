'use strict';

var SubWorkerProxy = (function SubWorkerProxyClosure() {
    function SubWorkerProxy() {
        var scriptsToImport = [
            AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js',
            AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/subworkerproxy.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    SubWorkerProxy.prototype.callSubWorker = function callSubWorker(depth) {
        var args = [depth];
        this._workerHelper.callFunction('callSubWorker', args);
    };
    
    return SubWorkerProxy;
})();