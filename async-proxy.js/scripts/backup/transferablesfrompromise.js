'use strict';

var TransferablesFromPromise = (function TransferablesFromPromiseClosure() {
    function TransferablesFromPromise() {
        var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    TransferablesFromPromise.prototype.passArrayBuffer = function passArrayBuffer(uint8Array) {
        var args = [uint8Array];
        var pathToTransferables = ['someProperty', 'buffer']; // Take promiseResult.someProperty.buffer as ports
        var portPaths = [pathToTransferables];
        
        var promise = this._workerHelper.callFunction('passArrayBuffer', args, {
            isReturnPromise: true,
            pathsToTransferablesInPromiseResult: portPaths });
        
        promise.then(function(result) {
            if (result.someProperty[0] === uint8Array[0]) {
                console.log('result is accessible in UI, what a fun!');
            }
        });
    };
    
    return TransferablesFromPromise;
})();