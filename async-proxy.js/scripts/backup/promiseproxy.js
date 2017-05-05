'use strict';

var PromiseProxy = (function PromiseProxyClosure() {
    function PromiseProxy() {
        var scriptsToImport = [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
        this._workerHelper = new asyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    PromiseProxy.prototype.asyncFunction = function asyncFunction() {
        var args = [];
        var promise = this._workerHelper.callFunction('asyncFunction', args, { isReturnPromise: true });
        return promise;
    };
    
    return PromiseProxy;
})();