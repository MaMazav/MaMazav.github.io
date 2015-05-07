var Callee = (function CalleeClosure() {
    function Callee(ctorArgument) {
        this._ctorArgument = ctorArgument;
    }
    
    Callee.prototype.helloWorld = function helloWorld(functionArgument) {
        console.log('Started Callee.helloWorld()...');
        
        var numIterations = this._ctorArgument.helloWorldCtorArgument * functionArgument;
        for (var i = 2; i < numIterations; ++i) {
            var x = Math.log(i);
            ++x;
        }
        
        console.log('Performed ' + numIterations + ' iterations in Callee.helloWorld()');
    };
    
    Callee.prototype.callSubWorker = function callSubWorker(depth) {
        console.log('I\'m a worker and going to have another ' + depth + ' sub-workers...');
        
        if (depth) {
            var childProxy = new SubWorkerProxy();
            childProxy.callSubWorker(depth - 1);
        }
    };
    
    Callee.prototype.asyncFunction = function asyncFunction() {
        var promise = new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve(5);
            }, 1000);
        });
        
        return promise;
    };
    
    Callee.prototype.asyncFunctionWithCallback = function asyncFunctionWithCallback(callback) {
        setTimeout(function() {
            callback(7);
        }, 1000);
    };
    
    Callee.prototype.asyncFunctionWithCallbackMultiple = function asyncFunctionWithCallbackMultiple(callback) {
        var remainingCalls = 3;
        
        var intervalHandle = setInterval(function() {
            var isFinished = (--remainingCalls) <= 0;
            var message = 'Still not finished, only status message';
            if (isFinished) {
                message = 'Finished! can clear the callback';
                clearInterval(intervalHandle);
            }
            
            callback({
                message: message,
                isFinished: isFinished
            });
        }, 1000);
    };
    
    Callee.prototype.releaseResources = function releaseResources() {
        var promise = new Promise(function(resolve, reject) {
            setTimeout(function() {
                console.log('Resources released!');
                resolve();
            }, 5000);
        });
        
        return promise;
    };
    
    Callee.prototype.passArrayBuffer = function passArrayBuffer(uint8Array) {
        var firstElement = uint8Array[0];
        console.log('First element of array - on worker: ' + firstElement);
        
        setTimeout(function() {
            try {
                var element = uint8Array[0];
                if (element !== firstElement) {
                    throw 'Wrong element';
                }
                
                console.log('Array is still accessible on worker');
            } catch(e) {
                console.log('Array is not accessible anymore on worker!');
            }
        }, 1000);
        
        return new Promise(function (resolve, reject) {
            resolve({ someProperty: uint8Array });
        });
    };
    
    Callee.prototype.returnArrayBufferByCallback = function returnArrayBufferByCallback(callback) {
        var uint8Array = new Uint8Array(2);
        uint8Array[0] = 22;
        uint8Array[1] = 93;
        
        var secondElement = uint8Array[1];
        console.log('Second element of array - on worker: ' + secondElement);
        
        callback({ anotherArrayProperty: [uint8Array] });
        
        try {
            var element = uint8Array[1];
            if (element !== secondElement) {
                throw 'Wrong element';
            }
            
            console.log('Array is still accessible on worker');
        } catch(e) {
            console.log('Array is not accessible anymore on worker!');
        }
    };
    
    Callee.prototype.urgentFunction = function urgentFunction(callNumber) {
        console.log('----------Called urgent function!!! callNumber = ' + callNumber);
    };
    
    Callee.prototype.nonUrgentFunction = function nonUrgentFunction(callNumber) {
        console.log('----------Called non-urgent function. callNumber = ' + callNumber);
    };
    
    return Callee;
})();