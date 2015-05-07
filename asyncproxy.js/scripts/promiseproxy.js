'use strict';

var PromiseProxy = (function PromiseProxyClosure() {
    function PromiseProxy() {
        var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/callee.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    PromiseProxy.prototype.asyncFunction = function asyncFunction() {
        var args = [];
        var promise = this._workerHelper.callFunction('asyncFunction', args, { isReturnPromise: true });
        return promise;
    };
    
    return PromiseProxy;
})();