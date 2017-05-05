'use strict';

var CallbackProxy = (function CallbackProxyClosure() {
    function CallbackProxy() {
        var scriptsToImport = [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
        this._workerHelper = new asyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    CallbackProxy.prototype.asyncFunctionWithCallback = function asyncFunctionWithCallback(callback) {
        var wrappedCallback = this._workerHelper.wrapCallback(
            callback, 'someNameForUserEvents');
        
        var args = [wrappedCallback];
        this._workerHelper.callFunction('asyncFunctionWithCallback', args);
    };
    
    return CallbackProxy;
})();