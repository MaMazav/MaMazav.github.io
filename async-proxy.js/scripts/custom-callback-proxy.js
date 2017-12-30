'use strict';

var CustomCallbackProxy = asyncProxy.AsyncProxyFactory.create(
    [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'],
    'Callee');

CustomCallbackProxy.prototype.returnArrayBufferByCallbackMultipleTimes = function returnArrayBufferByCallbackMultipleTimes(callback) {
    var workerHelper = asyncProxy.AsyncProxyFactory.getWorkerHelper(this);
    
    var portPath = [
        0, // First argument of callback
        'arrayProperty',
        'buffer'];

    var wrappedCallback = workerHelper.wrapCallback(
        internalCallbackForClear, 'someNameForUserEvents', {
            isMultipleTimeCallback: true,
            pathsToTransferables: [portPath]
        }
    );
    
    var args = [wrappedCallback];
    workerHelper.callFunction('returnArrayBufferByCallbackMultipleTimes', args);
    
    function internalCallbackForClear(argument) {
        callback(argument);
        if (argument.isFinished) {
            workerHelper.freeCallback(wrappedCallback);
        }
    }
};