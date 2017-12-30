'use strict';

var AsyncProxyMethodsCustom = asyncProxy.AsyncProxyFactory.create(
    [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'],
    'Callee');
    
AsyncProxyMethodsCustom.prototype.asyncFunction = function asyncFunction() {
    var workerHelper = asyncProxy.AsyncProxyFactory.getWorkerHelper(this);
    var args = [];
    var promise = workerHelper.callFunction('asyncFunction', args, { isReturnPromise: true });
    return promise;
};

AsyncProxyMethodsCustom.prototype.asyncFunctionWithCallback = function asyncFunctionWithCallback(callback) {
    var workerHelper = asyncProxy.AsyncProxyFactory.getWorkerHelper(this);

    var wrappedCallback = workerHelper.wrapCallback(
        callback, 'someNameForUserEvents');
    
    var args = [wrappedCallback];
    workerHelper.callFunction('asyncFunctionWithCallback', args);
};

AsyncProxyMethodsCustom.prototype.passArrayBuffer = function passArrayBuffer(uint8Array) {
    var workerHelper = asyncProxy.AsyncProxyFactory.getWorkerHelper(this);

    var firstElement = uint8Array[0];
    console.log('First element of array - on UI: ' + firstElement);
    
    var args = [uint8Array];
    workerHelper.callFunction('passArrayBuffer', args, {
        isReturnPromise: true,
        pathsToTransferablesInPromiseResult: [['someProperty', 'buffer']],
        transferables: function extractTransferablesFromArgument(args) {
            var uint8ArrayArg = args[0];
            return [uint8ArrayArg.buffer];
        }
    });
    
    try {
        var element = uint8Array[0];
        if (element !== firstElement) {
            throw 'Wrong element';
        }
    } catch(e) {
        console.log('Array is not accessible anymore on UI, that\'s great!');
    }
};

AsyncProxyMethodsCustom.prototype.urgentFunction = function urgentFunction(callNumber) {
    var workerHelper = asyncProxy.AsyncProxyFactory.getWorkerHelper(this);
    var args = [callNumber];
    workerHelper.callFunction('urgentFunction', args, {isSendImmediately:true});
};