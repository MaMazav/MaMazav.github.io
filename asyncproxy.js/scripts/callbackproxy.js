'use strict';

var CallbackProxy = (function CallbackProxyClosure() {
    function CallbackProxy() {
        var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/callee.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    CallbackProxy.prototype.asyncFunctionWithCallback = function asyncFunctionWithCallback(callback) {
        var wrappedCallback = this._workerHelper.wrapCallback(
            callback, 'someNameForErrorMessages');
        
        var args = [wrappedCallback];
        this._workerHelper.callFunction('asyncFunctionWithCallback', args);
    };
    
    return CallbackProxy;
})();