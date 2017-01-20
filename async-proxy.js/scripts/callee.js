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
                
                console.log('Array is still accessible on worker. BUG!');
            } catch(e) {
                console.log('Array is not accessible anymore on worker. As expected.');
            }
        }, 5);
        
        return new Promise(function (resolve, reject) {
            resolve({ someProperty: uint8Array });
        });
    };
    
    Callee.prototype.returnArrayBufferByCallbackMultipleTimes = function returnArrayBufferByCallback(callback) {
        var remainingCalls = 0;
        
        var intervalHandle = setInterval(function() {
            var isFinished = (++remainingCalls) >= 3;
            var message = isFinished ? 'Last status message: Finished! Can clear the callback'
									 : 'Status message ' + remainingCalls + ' of 3: not finished yet';
            if (isFinished) {
                clearInterval(intervalHandle);
			}
            
			var uint8Array = new Uint8Array(2);
			uint8Array[0] = 22;
			uint8Array[1] = 93;

            callback({
                message: message,
                isFinished: isFinished,
				arrayProperty: uint8Array
            });
			
			try {
				var element = uint8Array[1];
				if (element !== secondElement) {
					throw 'Wrong element';
				}
				console.log('Array is still accessible on worker. BUG!');
			} catch(e) {
				console.log('Array is not accessible anymore on worker, as expected.');
			}
        }, 1000);
    };
    
    Callee.prototype.urgentFunction = function urgentFunction(callNumber) {
        console.log('----------Called urgent function!!! callNumber = ' + callNumber);
    };
    
    Callee.prototype.nonUrgentFunction = function nonUrgentFunction(callNumber) {
        console.log('----------Called non-urgent function. callNumber = ' + callNumber);
    };
    
    return Callee;
})();