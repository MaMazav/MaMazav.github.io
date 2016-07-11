'use strict';

var BeforeOperationListener = (function BeforeOperationListenerClosure() {
    function BeforeOperationListener() {
        var scriptsToImport = [
            AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/beforeoperationlistenerslave.js',
            AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    BeforeOperationListener.prototype.asyncFunctionWithCallback = function asyncFunctionWithCallback(callback) {
        var wrappedCallback = this._workerHelper.wrapCallback(
            callback, 'someNameForUserEvents');
        
        var args = [wrappedCallback];
        this._workerHelper.callFunction('asyncFunctionWithCallback', args);
    };
    
    return BeforeOperationListener;
})();