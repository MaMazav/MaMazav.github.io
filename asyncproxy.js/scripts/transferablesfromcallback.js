'use strict';

var TransferablesFromCallback = (function TransferablesFromCallbackClosure() {
    function TransferablesFromCallback() {
        var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    TransferablesFromCallback.prototype.returnArrayBufferByCallback = function returnArrayBufferByCallback(callback) {
        var portPath = [
            0, // First argument of callback
            'anotherArrayProperty',
            0, // index in returned array
            'buffer'];
            
        var wrappedCallback = this._workerHelper.wrapCallback(
            callback, 'callbackDebugName', { pathsToTransferables: [portPath] });
        var args = [wrappedCallback];
        
        this._workerHelper.callFunction('returnArrayBufferByCallback', args);
        
        function internalCallback(result) {
            callback(result);
            
            var uint8Array = result.anotherArrayProperty[0];
            console.log('Second element - on UI: ' + uint8Array[1]);
        }
    };
    
    return TransferablesFromCallback;
})();