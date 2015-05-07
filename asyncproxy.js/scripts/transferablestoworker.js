'use strict';

var TransferablesToWorker = (function TransferablesToWorkerClosure() {
    function TransferablesToWorker() {
        var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/callee.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee');
    }
    
    TransferablesToWorker.prototype.passArrayBuffer = function passArrayBuffer(uint8Array) {
        var firstElement = uint8Array[0];
        console.log('First element of array - on UI: ' + firstElement);
        
        var args = [uint8Array];
        var ports = [uint8Array.buffer];
        this._workerHelper.callFunction('passArrayBuffer', args, { transferables: ports });
        
        try {
            var element = uint8Array[0];
            if (element !== firstElement) {
                throw 'Wrong element';
            }
        } catch(e) {
            console.log('Array is not accessible anymore on UI, that\'s great!');
        }
    };
    
    return TransferablesToWorker;
})();