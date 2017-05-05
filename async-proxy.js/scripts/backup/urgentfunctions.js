'use strict';

var UrgentFunctionsProxy = (function UrgentFunctionsProxyClosure() {
    function UrgentFunctionsProxy() {
        var scriptsToImport = [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
        var ctorArgs = [];
        this._workerHelper = new asyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee', ctorArgs, {
            functionsBufferSize: 3
        });
    }
    
    UrgentFunctionsProxy.prototype.urgentFunction = function urgentFunction(callNumber) {
        var args = [callNumber];
        this._workerHelper.callFunction('urgentFunction', args, { isSendImmediately: true });
    };
    
    UrgentFunctionsProxy.prototype.nonUrgentFunction = function nonUrgentFunction(callNumber) {
        var args = [callNumber];
        this._workerHelper.callFunction('nonUrgentFunction', args);
    };
    
    return UrgentFunctionsProxy;
})();