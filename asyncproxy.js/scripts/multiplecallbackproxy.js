'use strict';

var MultipleCallbackProxy = (function MultipleCallbackProxyClosure() {
    function MultipleCallbackProxy() {
        var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    MultipleCallbackProxy.prototype.asyncFunctionWithCallbackMultiple = function asyncFunctionWithCallbackMultiple(callback) {
        var workerHelper = this._workerHelper;
        
        var wrappedCallback = this._workerHelper.wrapCallback(
            internalCallbackForClear, 'someNameForUserEvents', { isMultipleTimeCallback: true });
        
        var args = [wrappedCallback];
        this._workerHelper.callFunction('asyncFunctionWithCallbackMultiple', args);
        
        function internalCallbackForClear(argument) {
            callback(argument);
            if (argument.isFinished) {
                workerHelper.freeCallback(wrappedCallback);
            }
        }
    };
    
    return MultipleCallbackProxy;
})();