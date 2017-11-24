(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.asyncProxy = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports.SubWorkerEmulationForChrome = require('sub-worker-emulation-for-chrome');
module.exports.AsyncProxyFactory = require('async-proxy-factory');
module.exports.AsyncProxySlave = require('async-proxy-slave');
module.exports.AsyncProxyMaster = require('async-proxy-master');
module.exports.ScriptsToImportPool = require('scripts-to-Import-Pool');

},{"async-proxy-factory":2,"async-proxy-master":3,"async-proxy-slave":4,"scripts-to-Import-Pool":5,"sub-worker-emulation-for-chrome":7}],2:[function(require,module,exports){
'use strict';

var AsyncProxyMaster = require('async-proxy-master');

var AsyncProxyFactory = (function AsyncProxyFactoryClosure() {
    var factorySingleton = {};
	
	factorySingleton.create = function create(scriptsToImport, ctorName, methods, proxyCtor) {
		if ((!scriptsToImport) || !(scriptsToImport.length)) {
			throw 'AsyncProxyFactory error: missing scriptsToImport (2nd argument)';
		}
		
		var ProxyClass = proxyCtor || function() {
			var ctorArgs = factorySingleton.convertArgs(arguments);
			factorySingleton.initialize(this, scriptsToImport, ctorName, ctorArgs);
		};
		
		if (methods) {
			factorySingleton.addMethods(ProxyClass, methods);
		}
		
		return ProxyClass;
	};
	
	factorySingleton.addMethods = function addMethods(ProxyClass, methods) {
		for (var methodName in methods) {
			generateMethod(ProxyClass, methodName, methods[methodName] || []);
		}
		
		return ProxyClass;
	};
	
	function generateMethod(ProxyClass, methodName, methodArgsDescription) {
		var methodOptions = methodArgsDescription[0] || {};
		ProxyClass.prototype[methodName] = function generatedFunction() {
			var workerHelper = factorySingleton.getWorkerHelper(this);
			var argsToSend = [];
			for (var i = 0; i < arguments.length; ++i) {
				var argDescription = methodArgsDescription[i + 1];
				var argValue = arguments[i];
				
				if (argDescription === 'callback') {
					argsToSend[i] = workerHelper.wrapCallback(argValue);
				} else if (!argDescription) {
					argsToSend[i] = argValue;
				} else {
					throw 'AsyncProxyFactory error: Unrecognized argument ' +
						'description ' + argDescription + ' in argument ' +
						(i + 1) + ' of method ' + methodName;
				}
			}
			return workerHelper.callFunction(
				methodName, argsToSend, methodArgsDescription[0]);
		};
	}
	
	factorySingleton.initialize = function initialize(proxyInstance, scriptsToImport, ctorName, ctorArgs) {
		if (proxyInstance.__workerHelperInitArgs) {
			throw 'asyncProxy error: Double initialization of AsyncProxy master';
		}
		proxyInstance.__workerHelperInitArgs = {
			scriptsToImport: scriptsToImport,
			ctorName: ctorName,
			ctorArgs: ctorArgs
		};
	};
	
	factorySingleton.convertArgs = function convertArgs(argsObject) {
		var args = new Array(argsObject.length);
		for (var i = 0; i < argsObject.length; ++i) {
			args[i] = argsObject[i];
		}
		
		return args;
	};
    
	factorySingleton.getWorkerHelper = function getWorkerHelper(proxyInstance) {
		if (!proxyInstance.__workerHelper) {
			if (!proxyInstance.__workerHelperInitArgs) {
				throw 'asyncProxy error: asyncProxyFactory.initialize() not called yet';
			}
			
			proxyInstance.__workerHelper = new AsyncProxyMaster(
				proxyInstance.__workerHelperInitArgs.scriptsToImport,
				proxyInstance.__workerHelperInitArgs.ctorName,
				proxyInstance.__workerHelperInitArgs.ctorArgs || []);
		}
		
		return proxyInstance.__workerHelper;
	};

    return factorySingleton;
})();

module.exports = AsyncProxyFactory;
},{"async-proxy-master":3}],3:[function(require,module,exports){
'use strict';

/* global Promise: false */

var ScriptsToImportPool = require('scripts-to-import-pool');

var AsyncProxyMaster = (function AsyncProxyMasterClosure() {
    var callId = 0;
    var isGetMasterEntryUrlCalled = false;
    var masterEntryUrl = getBaseUrlFromEntryScript();
    
    function AsyncProxyMaster(scriptsToImport, ctorName, ctorArgs, options) {
        var that = this;
        options = options || {};
        
        that._callbacks = [];
        that._pendingPromiseCalls = [];
        that._subWorkerById = [];
        that._subWorkers = [];
        that._userDataHandler = null;
        that._notReturnedFunctions = 0;
        that._functionsBufferSize = options.functionsBufferSize || 5;
        that._pendingMessages = [];
        
        var scriptName = getScriptName();
        var slaveScriptContentString = mainSlaveScriptContent.toString();
        slaveScriptContentString = slaveScriptContentString.replace(
            'SCRIPT_PLACEHOLDER', scriptName);
        var slaveScriptContentBlob = new Blob(
            ['(', slaveScriptContentString, ')()'],
            { type: 'application/javascript' });
        var slaveScriptUrl = URL.createObjectURL(slaveScriptContentBlob);

        that._worker = new Worker(slaveScriptUrl);
        that._worker.onmessage = onWorkerMessageInternal;

        that._worker.postMessage({
            functionToCall: 'ctor',
            scriptsToImport: scriptsToImport,
            ctorName: ctorName,
            args: ctorArgs,
            callId: ++callId,
            isPromise: false,
            masterEntryUrl: AsyncProxyMaster.getEntryUrl()
        });
        
        function onWorkerMessageInternal(workerEvent) {
            onWorkerMessage(that, workerEvent);
        }
    }
    
    AsyncProxyMaster.prototype.setUserDataHandler = function setUserDataHandler(userDataHandler) {
        this._userDataHandler = userDataHandler;
    };
    
    AsyncProxyMaster.prototype.terminate = function terminate() {
        this._worker.terminate();
        for (var i = 0; i < this._subWorkers.length; ++i) {
            this._subWorkers[i].terminate();
        }
    };
    
    AsyncProxyMaster.prototype.callFunction = function callFunction(functionToCall, args, options) {
        options = options || {};
        var isReturnPromise = !!options.isReturnPromise;
        var transferablesArg = options.transferables || [];
        var pathsToTransferables =
            options.pathsToTransferablesInPromiseResult;
        
        var localCallId = ++callId;
        var promiseOnMasterSide = null;
        var that = this;
        
        if (isReturnPromise) {
            promiseOnMasterSide = new Promise(function promiseFunc(resolve, reject) {
                that._pendingPromiseCalls[localCallId] = {
                    resolve: resolve,
                    reject: reject
                };
            });
        }
        
        var sendMessageFunction = options.isSendImmediately ?
            sendMessageToSlave: enqueueMessageToSlave;
		
		var transferables;
		if (typeof transferablesArg === 'function') {
			transferables = transferablesArg();
		} else {
			transferables = AsyncProxyMaster._extractTransferables(
				transferablesArg, args);
		}
        
        sendMessageFunction(this, transferables, /*isFunctionCall=*/true, {
            functionToCall: functionToCall,
            args: args || [],
            callId: localCallId,
            isPromise: isReturnPromise,
            pathsToTransferablesInPromiseResult : pathsToTransferables
        });
        
        if (isReturnPromise) {
            return promiseOnMasterSide;
        }
    };
    
    AsyncProxyMaster.prototype.wrapCallback = function wrapCallback(
        callback, callbackName, options) {
        
        options = options || {};
        var localCallId = ++callId;
        
        var callbackHandle = {
            isWorkerHelperCallback: true,
            isMultipleTimeCallback: !!options.isMultipleTimeCallback,
            callId: localCallId,
            callbackName: callbackName,
            pathsToTransferables: options.pathsToTransferables
        };
        
        var internalCallbackHandle = {
            isMultipleTimeCallback: !!options.isMultipleTimeCallback,
            callId: localCallId,
            callback: callback,
            pathsToTransferables: options.pathsToTransferables
        };
        
        this._callbacks[localCallId] = internalCallbackHandle;
        
        return callbackHandle;
    };
    
    AsyncProxyMaster.prototype.freeCallback = function freeCallback(callbackHandle) {
        delete this._callbacks[callbackHandle.callId];
    };
    
    // Static functions
    
    AsyncProxyMaster.getEntryUrl = function getEntryUrl() {
        isGetMasterEntryUrlCalled = true;
        return masterEntryUrl;
    };
    
    AsyncProxyMaster._setEntryUrl = function setEntryUrl(newUrl) {
        if (masterEntryUrl !== newUrl && isGetMasterEntryUrlCalled) {
            throw 'Previous values returned from getMasterEntryUrl ' +
                'is wrong. Avoid calling it within the slave c`tor';
        }

        masterEntryUrl = newUrl;
    };
	
	AsyncProxyMaster._extractTransferables = function extractTransferables(
			pathsToTransferables, pathsBase) {
		
        if (pathsToTransferables === undefined) {
            return undefined;
        }
        
        var transferables = new Array(pathsToTransferables.length);
        
        for (var i = 0; i < pathsToTransferables.length; ++i) {
            var path = pathsToTransferables[i];
            var transferable = pathsBase;
            
            for (var j = 0; j < path.length; ++j) {
                var member = path[j];
                transferable = transferable[member];
            }
            
            transferables[i] = transferable;
        }
        
        return transferables;
    };
    
    // Private functions
	
	function getScriptName() {
        var error = new Error();
		return ScriptsToImportPool._getScriptName(error);
	}
    
    function mainSlaveScriptContent() {
		// This function is not run directly: It copied as a string into a blob
		// and run in the Web Worker global scope
		
		/* global importScripts: false */
        importScripts('SCRIPT_PLACEHOLDER');
		/* global asyncProxy: false */
        asyncProxy.AsyncProxySlave._initializeSlave();
    }
    
    function onWorkerMessage(that, workerEvent) {
        var callId = workerEvent.data.callId;
        
        switch (workerEvent.data.type) {
            case 'functionCalled':
                --that._notReturnedFunctions;
                trySendPendingMessages(that);
                break;
            
            case 'promiseResult':
                var promiseToResolve = that._pendingPromiseCalls[callId];
                delete that._pendingPromiseCalls[callId];
                
                var result = workerEvent.data.result;
                promiseToResolve.resolve(result);
                
                break;
            
            case 'promiseFailure':
                var promiseToReject = that._pendingPromiseCalls[callId];
                delete that._pendingPromiseCalls[callId];
                
                var reason = workerEvent.data.reason;
                promiseToReject.reject(reason);
                
                break;
            
            case 'userData':
                if (that._userDataHandler !== null) {
                    that._userDataHandler(workerEvent.data.userData);
                }
                
                break;
            
            case 'callback':
                var callbackHandle = that._callbacks[workerEvent.data.callId];
                if (callbackHandle === undefined) {
                    throw 'Unexpected message from SlaveWorker of callback ID: ' +
                        workerEvent.data.callId + '. Maybe should indicate ' +
                        'isMultipleTimesCallback = true on creation?';
                }
                
                if (!callbackHandle.isMultipleTimeCallback) {
                    that.freeCallback(that._callbacks[workerEvent.data.callId]);
                }
                
                if (callbackHandle.callback !== null) {
                    callbackHandle.callback.apply(null, workerEvent.data.args);
                }
                
                break;
            
            case 'subWorkerCtor':
                var subWorkerCreated = new Worker(workerEvent.data.scriptUrl);
                var id = workerEvent.data.subWorkerId;
                
                that._subWorkerById[id] = subWorkerCreated;
                that._subWorkers.push(subWorkerCreated);
                
                subWorkerCreated.onmessage = function onSubWorkerMessage(subWorkerEvent) {
                    enqueueMessageToSlave(
                        that, subWorkerEvent.ports, /*isFunctionCall=*/false, {
                            functionToCall: 'subWorkerOnMessage',
                            subWorkerId: id,
                            data: subWorkerEvent.data
                        });
                };
                
                break;
            
            case 'subWorkerPostMessage':
                var subWorkerToPostMessage = that._subWorkerById[workerEvent.data.subWorkerId];
                subWorkerToPostMessage.postMessage(workerEvent.data.data);
                break;
            
            case 'subWorkerTerminate':
                var subWorkerToTerminate = that._subWorkerById[workerEvent.data.subWorkerId];
                subWorkerToTerminate.terminate();
                break;
            
            default:
                throw 'Unknown message from AsyncProxySlave of type: ' +
                    workerEvent.data.type;
        }
    }
    
    function enqueueMessageToSlave(
        that, transferables, isFunctionCall, message) {
        
        if (that._notReturnedFunctions >= that._functionsBufferSize) {
            that._pendingMessages.push({
                transferables: transferables,
                isFunctionCall: isFunctionCall,
                message: message
            });
            return;
        }
        
        sendMessageToSlave(that, transferables, isFunctionCall, message);
    }
        
    function sendMessageToSlave(
        that, transferables, isFunctionCall, message) {
        
        if (isFunctionCall) {
            ++that._notReturnedFunctions;
        }
        
        that._worker.postMessage(message, transferables);
    }
    
    function trySendPendingMessages(that) {
        while (that._notReturnedFunctions < that._functionsBufferSize &&
               that._pendingMessages.length > 0) {
            
            var message = that._pendingMessages.shift();
            sendMessageToSlave(
                that,
                message.transferables,
                message.isFunctionCall,
                message.message);
        }
    }
    
    function getBaseUrlFromEntryScript() {
        var baseUrl = location.href;
        var endOfPath = baseUrl.lastIndexOf('/');
        if (endOfPath >= 0) {
            baseUrl = baseUrl.substring(0, endOfPath);
        }
        
        return baseUrl;
    }
    
    return AsyncProxyMaster;
})();

module.exports = AsyncProxyMaster;
},{"scripts-to-import-pool":6}],4:[function(require,module,exports){
'use strict';

/* global console: false */
/* global self: false */

var AsyncProxyMaster = require('async-proxy-master');
var SubWorkerEmulationForChrome = require('sub-worker-emulation-for-chrome');

var AsyncProxySlave = (function AsyncProxySlaveClosure() {
    var slaveHelperSingleton = {};
    
    var beforeOperationListener = null;
    var slaveSideMainInstance;
    var slaveSideInstanceCreator = defaultInstanceCreator;
    var subWorkerIdToSubWorker = {};
    var ctorName;
    
    slaveHelperSingleton._initializeSlave = function initializeSlave() {
        self.onmessage = onMessage;
    };
    
    slaveHelperSingleton.setSlaveSideCreator = function setSlaveSideCreator(creator) {
        slaveSideInstanceCreator = creator;
    };
    
    slaveHelperSingleton.setBeforeOperationListener =
        function setBeforeOperationListener(listener) {
            beforeOperationListener = listener;
        };
        
    slaveHelperSingleton.sendUserDataToMaster = function sendUserDataToMaster(
        userData) {
        
        self.postMessage({
            type: 'userData',
            userData: userData
        });
    };
    
    slaveHelperSingleton.wrapPromiseFromSlaveSide =
        function wrapPromiseFromSlaveSide(
            callId, promise, pathsToTransferables) {
        
        var promiseThen = promise.then(function sendPromiseToMaster(result) {
            var transferables =
				AsyncProxyMaster._extractTransferables(
					pathsToTransferables, result);
            
            self.postMessage(
                {
                    type: 'promiseResult',
                    callId: callId,
                    result: result
                },
                transferables);
        });
        
        promiseThen['catch'](function sendFailureToMaster(reason) {
            self.postMessage({
                type: 'promiseFailure',
                callId: callId,
                reason: reason
            });
        });
    };
    
    slaveHelperSingleton.wrapCallbackFromSlaveSide =
        function wrapCallbackFromSlaveSide(callbackHandle) {
            
        var isAlreadyCalled = false;
        
        function callbackWrapperFromSlaveSide() {
            if (isAlreadyCalled) {
                throw 'Callback is called twice but isMultipleTimeCallback ' +
                    '= false';
            }
            
            var argumentsAsArray = getArgumentsAsArray(arguments);
            
            if (beforeOperationListener !== null) {
				try {
					beforeOperationListener.call(
						slaveSideMainInstance,
						'callback',
						callbackHandle.callbackName,
						argumentsAsArray);
				} catch (e) {
					console.log('AsyncProxySlave.beforeOperationListener has thrown an exception: ' + e);
				}
            }
            
            var transferables =
				AsyncProxyMaster._extractTransferables(
					callbackHandle.pathsToTransferables, argumentsAsArray);
            
            self.postMessage({
                    type: 'callback',
                    callId: callbackHandle.callId,
                    args: argumentsAsArray
                },
                transferables);
            
            if (!callbackHandle.isMultipleTimeCallback) {
                isAlreadyCalled = true;
            }
        }
        
        return callbackWrapperFromSlaveSide;
    };
    
    function onMessage(event) {
        var functionNameToCall = event.data.functionToCall;
        var args = event.data.args;
        var callId = event.data.callId;
        var isPromise = event.data.isPromise;
        var pathsToTransferablesInPromiseResult =
            event.data.pathsToTransferablesInPromiseResult;
        
        var result = null;
        
        switch (functionNameToCall) {
            case 'ctor':
                AsyncProxyMaster._setEntryUrl(event.data.masterEntryUrl);
                
                var scriptsToImport = event.data.scriptsToImport;
                ctorName = event.data.ctorName;
                
                for (var i = 0; i < scriptsToImport.length; ++i) {
					/* global importScripts: false */
                    importScripts(scriptsToImport[i]);
                }
                
                slaveSideMainInstance = slaveSideInstanceCreator.apply(null, args);

                return;
            
            case 'subWorkerOnMessage':
                var subWorker = subWorkerIdToSubWorker[event.data.subWorkerId];
                var workerEvent = { data: event.data.data };
                
                subWorker.onmessage(workerEvent);
                
                return;
        }
        
        args = new Array(event.data.args.length);
        for (var j = 0; j < event.data.args.length; ++j) {
            var arg = event.data.args[j];
            if (arg !== undefined &&
                arg !== null &&
                arg.isWorkerHelperCallback) {
                
                arg = slaveHelperSingleton.wrapCallbackFromSlaveSide(arg);
            }
            
            args[j] = arg;
        }
        
        var functionContainer = slaveSideMainInstance;
        var functionToCall;
        while (functionContainer) {
            functionToCall = slaveSideMainInstance[functionNameToCall];
            if (functionToCall) {
                break;
            }
			/* jshint proto: true */
            functionContainer = functionContainer.__proto__;
        }
        
        if (!functionToCall) {
            throw 'AsyncProxy error: could not find function ' + functionNameToCall;
        }
        
        var promise = functionToCall.apply(slaveSideMainInstance, args);
        
        if (isPromise) {
            slaveHelperSingleton.wrapPromiseFromSlaveSide(
                callId, promise, pathsToTransferablesInPromiseResult);
        }

        self.postMessage({
            type: 'functionCalled',
            callId: event.data.callId,
            result: result
        });
    }
    
    function defaultInstanceCreator() {
        var instance;
        try {
            var namespacesAndCtorName = ctorName.split('.');
            var member = self;
            for (var i = 0; i < namespacesAndCtorName.length; ++i)
                member = member[namespacesAndCtorName[i]];
            var TypeCtor = member;
            
            var bindArgs = [null].concat(getArgumentsAsArray(arguments));
            instance = new (Function.prototype.bind.apply(TypeCtor, bindArgs))();
        } catch (e) {
            throw new Error('Failed locating class name ' + ctorName + ': ' + e);
        }
        
        return instance;
    }
    
    function getArgumentsAsArray(args) {
        var argumentsAsArray = new Array(args.length);
        for (var i = 0; i < args.length; ++i) {
            argumentsAsArray[i] = args[i];
        }
        
        return argumentsAsArray;
    }
    
    if (self.Worker === undefined) {
        SubWorkerEmulationForChrome.initialize(subWorkerIdToSubWorker);
        self.Worker = SubWorkerEmulationForChrome;
    }
    
    return slaveHelperSingleton;
})();

module.exports = AsyncProxySlave;
},{"async-proxy-master":3,"sub-worker-emulation-for-chrome":7}],5:[function(require,module,exports){
'use strict';

var ScriptsToImportPool = (function ScriptsToImportPoolClosure() {
	var currentStackFrameRegex = /at (|[^ ]+ \()([^ ]+):\d+:\d+/;
	var lastStackFrameRegexWithStrudel = new RegExp(/.+@(.*?):\d+:\d+/);
	var lastStackFrameRegex = new RegExp(/.+\/(.*?):\d+(:\d+)*$/);

    function ScriptsToImportPool() {
        var that = this;
        that._scriptsByName = {};
        that._scriptsArray = null;
    }
    
    ScriptsToImportPool.prototype.addScriptFromErrorWithStackTrace =
        function addScriptForWorkerImport(errorWithStackTrace) {
        
        var fileName = ScriptsToImportPool._getScriptName(errorWithStackTrace);
        
        if (!this._scriptsByName[fileName]) {
            this._scriptsByName[fileName] = true;
            this._scriptsArray = null;
        }
    };
    
    ScriptsToImportPool.prototype.getScriptsForWorkerImport =
        function getScriptsForWorkerImport() {
        
        if (this._scriptsArray === null) {
            this._scriptsArray = [];
            for (var fileName in this._scriptsByName) {
                this._scriptsArray.push(fileName);
            }
        }
        
        return this._scriptsArray;
    };
    
    ScriptsToImportPool._getScriptName = function getScriptName(errorWithStackTrace) {
        var stack = errorWithStackTrace.stack.trim();
        
        var source = currentStackFrameRegex.exec(stack);
        if (source && source[2] !== "") {
            return source[2];
        }

        source = lastStackFrameRegexWithStrudel.exec(stack);
		if (source && (source[1] !== "")) {
			return source[1];
		}
        
        source = lastStackFrameRegex.exec(stack);
        if (source && source[1] !== "") {
            return source[1];
        }
        
        if (errorWithStackTrace.fileName !== undefined) {
            return errorWithStackTrace.fileName;
        }
        
        throw 'ImageDecoderFramework.js: Could not get current script URL';
    };
    
    return ScriptsToImportPool;
})();

module.exports = ScriptsToImportPool;
},{}],6:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],7:[function(require,module,exports){
'use strict';

/* global self: false */

var SubWorkerEmulationForChrome = (function SubWorkerEmulationForChromeClosure() {
    var subWorkerId = 0;
    var subWorkerIdToSubWorker = null;
    
    function SubWorkerEmulationForChrome(scriptUrl) {
        if (subWorkerIdToSubWorker === null) {
            throw 'AsyncProxy internal error: SubWorkerEmulationForChrome ' +
                'not initialized';
        }
        
        var that = this;
        that._subWorkerId = ++subWorkerId;
        subWorkerIdToSubWorker[that._subWorkerId] = that;
        
        self.postMessage({
            type: 'subWorkerCtor',
            subWorkerId: that._subWorkerId,
            scriptUrl: scriptUrl
        });
    }
    
    SubWorkerEmulationForChrome.initialize = function initialize(
        subWorkerIdToSubWorker_) {
        
        subWorkerIdToSubWorker = subWorkerIdToSubWorker_;
    };
    
    SubWorkerEmulationForChrome.prototype.postMessage = function postMessage(
        data, transferables) {
        
        self.postMessage({
            type: 'subWorkerPostMessage',
            subWorkerId: this._subWorkerId,
            data: data
        },
        transferables);
    };
    
    SubWorkerEmulationForChrome.prototype.terminate = function terminate(
        data, transferables) {
        
        self.postMessage({
            type: 'subWorkerTerminate',
            subWorkerId: this._subWorkerId
        },
        transferables);
    };
    
    return SubWorkerEmulationForChrome;
})();

module.exports = SubWorkerEmulationForChrome;
},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXN5bmMtcHJveHktZXhwb3J0cy5qcyIsInNyYy9hc3luYy1wcm94eS1mYWN0b3J5LmpzIiwic3JjL2FzeW5jLXByb3h5LW1hc3Rlci5qcyIsInNyYy9hc3luYy1wcm94eS1zbGF2ZS5qcyIsInNyYy9zY3JpcHRzLXRvLUltcG9ydC1Qb29sLmpzIiwic3JjL3N1Yi13b3JrZXItZW11bGF0aW9uLWZvci1jaHJvbWUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMuU3ViV29ya2VyRW11bGF0aW9uRm9yQ2hyb21lID0gcmVxdWlyZSgnc3ViLXdvcmtlci1lbXVsYXRpb24tZm9yLWNocm9tZScpO1xyXG5tb2R1bGUuZXhwb3J0cy5Bc3luY1Byb3h5RmFjdG9yeSA9IHJlcXVpcmUoJ2FzeW5jLXByb3h5LWZhY3RvcnknKTtcclxubW9kdWxlLmV4cG9ydHMuQXN5bmNQcm94eVNsYXZlID0gcmVxdWlyZSgnYXN5bmMtcHJveHktc2xhdmUnKTtcclxubW9kdWxlLmV4cG9ydHMuQXN5bmNQcm94eU1hc3RlciA9IHJlcXVpcmUoJ2FzeW5jLXByb3h5LW1hc3RlcicpO1xyXG5tb2R1bGUuZXhwb3J0cy5TY3JpcHRzVG9JbXBvcnRQb29sID0gcmVxdWlyZSgnc2NyaXB0cy10by1JbXBvcnQtUG9vbCcpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgQXN5bmNQcm94eU1hc3RlciA9IHJlcXVpcmUoJ2FzeW5jLXByb3h5LW1hc3RlcicpO1xyXG5cclxudmFyIEFzeW5jUHJveHlGYWN0b3J5ID0gKGZ1bmN0aW9uIEFzeW5jUHJveHlGYWN0b3J5Q2xvc3VyZSgpIHtcclxuICAgIHZhciBmYWN0b3J5U2luZ2xldG9uID0ge307XHJcblx0XHJcblx0ZmFjdG9yeVNpbmdsZXRvbi5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoc2NyaXB0c1RvSW1wb3J0LCBjdG9yTmFtZSwgbWV0aG9kcywgcHJveHlDdG9yKSB7XHJcblx0XHRpZiAoKCFzY3JpcHRzVG9JbXBvcnQpIHx8ICEoc2NyaXB0c1RvSW1wb3J0Lmxlbmd0aCkpIHtcclxuXHRcdFx0dGhyb3cgJ0FzeW5jUHJveHlGYWN0b3J5IGVycm9yOiBtaXNzaW5nIHNjcmlwdHNUb0ltcG9ydCAoMm5kIGFyZ3VtZW50KSc7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHZhciBQcm94eUNsYXNzID0gcHJveHlDdG9yIHx8IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgY3RvckFyZ3MgPSBmYWN0b3J5U2luZ2xldG9uLmNvbnZlcnRBcmdzKGFyZ3VtZW50cyk7XHJcblx0XHRcdGZhY3RvcnlTaW5nbGV0b24uaW5pdGlhbGl6ZSh0aGlzLCBzY3JpcHRzVG9JbXBvcnQsIGN0b3JOYW1lLCBjdG9yQXJncyk7XHJcblx0XHR9O1xyXG5cdFx0XHJcblx0XHRpZiAobWV0aG9kcykge1xyXG5cdFx0XHRmYWN0b3J5U2luZ2xldG9uLmFkZE1ldGhvZHMoUHJveHlDbGFzcywgbWV0aG9kcyk7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHJldHVybiBQcm94eUNsYXNzO1xyXG5cdH07XHJcblx0XHJcblx0ZmFjdG9yeVNpbmdsZXRvbi5hZGRNZXRob2RzID0gZnVuY3Rpb24gYWRkTWV0aG9kcyhQcm94eUNsYXNzLCBtZXRob2RzKSB7XHJcblx0XHRmb3IgKHZhciBtZXRob2ROYW1lIGluIG1ldGhvZHMpIHtcclxuXHRcdFx0Z2VuZXJhdGVNZXRob2QoUHJveHlDbGFzcywgbWV0aG9kTmFtZSwgbWV0aG9kc1ttZXRob2ROYW1lXSB8fCBbXSk7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHJldHVybiBQcm94eUNsYXNzO1xyXG5cdH07XHJcblx0XHJcblx0ZnVuY3Rpb24gZ2VuZXJhdGVNZXRob2QoUHJveHlDbGFzcywgbWV0aG9kTmFtZSwgbWV0aG9kQXJnc0Rlc2NyaXB0aW9uKSB7XHJcblx0XHR2YXIgbWV0aG9kT3B0aW9ucyA9IG1ldGhvZEFyZ3NEZXNjcmlwdGlvblswXSB8fCB7fTtcclxuXHRcdFByb3h5Q2xhc3MucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24gZ2VuZXJhdGVkRnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciB3b3JrZXJIZWxwZXIgPSBmYWN0b3J5U2luZ2xldG9uLmdldFdvcmtlckhlbHBlcih0aGlzKTtcclxuXHRcdFx0dmFyIGFyZ3NUb1NlbmQgPSBbXTtcclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcclxuXHRcdFx0XHR2YXIgYXJnRGVzY3JpcHRpb24gPSBtZXRob2RBcmdzRGVzY3JpcHRpb25baSArIDFdO1xyXG5cdFx0XHRcdHZhciBhcmdWYWx1ZSA9IGFyZ3VtZW50c1tpXTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRpZiAoYXJnRGVzY3JpcHRpb24gPT09ICdjYWxsYmFjaycpIHtcclxuXHRcdFx0XHRcdGFyZ3NUb1NlbmRbaV0gPSB3b3JrZXJIZWxwZXIud3JhcENhbGxiYWNrKGFyZ1ZhbHVlKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCFhcmdEZXNjcmlwdGlvbikge1xyXG5cdFx0XHRcdFx0YXJnc1RvU2VuZFtpXSA9IGFyZ1ZhbHVlO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aHJvdyAnQXN5bmNQcm94eUZhY3RvcnkgZXJyb3I6IFVucmVjb2duaXplZCBhcmd1bWVudCAnICtcclxuXHRcdFx0XHRcdFx0J2Rlc2NyaXB0aW9uICcgKyBhcmdEZXNjcmlwdGlvbiArICcgaW4gYXJndW1lbnQgJyArXHJcblx0XHRcdFx0XHRcdChpICsgMSkgKyAnIG9mIG1ldGhvZCAnICsgbWV0aG9kTmFtZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHdvcmtlckhlbHBlci5jYWxsRnVuY3Rpb24oXHJcblx0XHRcdFx0bWV0aG9kTmFtZSwgYXJnc1RvU2VuZCwgbWV0aG9kQXJnc0Rlc2NyaXB0aW9uWzBdKTtcclxuXHRcdH07XHJcblx0fVxyXG5cdFxyXG5cdGZhY3RvcnlTaW5nbGV0b24uaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uIGluaXRpYWxpemUocHJveHlJbnN0YW5jZSwgc2NyaXB0c1RvSW1wb3J0LCBjdG9yTmFtZSwgY3RvckFyZ3MpIHtcclxuXHRcdGlmIChwcm94eUluc3RhbmNlLl9fd29ya2VySGVscGVySW5pdEFyZ3MpIHtcclxuXHRcdFx0dGhyb3cgJ2FzeW5jUHJveHkgZXJyb3I6IERvdWJsZSBpbml0aWFsaXphdGlvbiBvZiBBc3luY1Byb3h5IG1hc3Rlcic7XHJcblx0XHR9XHJcblx0XHRwcm94eUluc3RhbmNlLl9fd29ya2VySGVscGVySW5pdEFyZ3MgPSB7XHJcblx0XHRcdHNjcmlwdHNUb0ltcG9ydDogc2NyaXB0c1RvSW1wb3J0LFxyXG5cdFx0XHRjdG9yTmFtZTogY3Rvck5hbWUsXHJcblx0XHRcdGN0b3JBcmdzOiBjdG9yQXJnc1xyXG5cdFx0fTtcclxuXHR9O1xyXG5cdFxyXG5cdGZhY3RvcnlTaW5nbGV0b24uY29udmVydEFyZ3MgPSBmdW5jdGlvbiBjb252ZXJ0QXJncyhhcmdzT2JqZWN0KSB7XHJcblx0XHR2YXIgYXJncyA9IG5ldyBBcnJheShhcmdzT2JqZWN0Lmxlbmd0aCk7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3NPYmplY3QubGVuZ3RoOyArK2kpIHtcclxuXHRcdFx0YXJnc1tpXSA9IGFyZ3NPYmplY3RbaV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHJldHVybiBhcmdzO1xyXG5cdH07XHJcbiAgICBcclxuXHRmYWN0b3J5U2luZ2xldG9uLmdldFdvcmtlckhlbHBlciA9IGZ1bmN0aW9uIGdldFdvcmtlckhlbHBlcihwcm94eUluc3RhbmNlKSB7XHJcblx0XHRpZiAoIXByb3h5SW5zdGFuY2UuX193b3JrZXJIZWxwZXIpIHtcclxuXHRcdFx0aWYgKCFwcm94eUluc3RhbmNlLl9fd29ya2VySGVscGVySW5pdEFyZ3MpIHtcclxuXHRcdFx0XHR0aHJvdyAnYXN5bmNQcm94eSBlcnJvcjogYXN5bmNQcm94eUZhY3RvcnkuaW5pdGlhbGl6ZSgpIG5vdCBjYWxsZWQgeWV0JztcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0cHJveHlJbnN0YW5jZS5fX3dvcmtlckhlbHBlciA9IG5ldyBBc3luY1Byb3h5TWFzdGVyKFxyXG5cdFx0XHRcdHByb3h5SW5zdGFuY2UuX193b3JrZXJIZWxwZXJJbml0QXJncy5zY3JpcHRzVG9JbXBvcnQsXHJcblx0XHRcdFx0cHJveHlJbnN0YW5jZS5fX3dvcmtlckhlbHBlckluaXRBcmdzLmN0b3JOYW1lLFxyXG5cdFx0XHRcdHByb3h5SW5zdGFuY2UuX193b3JrZXJIZWxwZXJJbml0QXJncy5jdG9yQXJncyB8fCBbXSk7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHJldHVybiBwcm94eUluc3RhbmNlLl9fd29ya2VySGVscGVyO1xyXG5cdH07XHJcblxyXG4gICAgcmV0dXJuIGZhY3RvcnlTaW5nbGV0b247XHJcbn0pKCk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEFzeW5jUHJveHlGYWN0b3J5OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbi8qIGdsb2JhbCBQcm9taXNlOiBmYWxzZSAqL1xyXG5cclxudmFyIFNjcmlwdHNUb0ltcG9ydFBvb2wgPSByZXF1aXJlKCdzY3JpcHRzLXRvLWltcG9ydC1wb29sJyk7XHJcblxyXG52YXIgQXN5bmNQcm94eU1hc3RlciA9IChmdW5jdGlvbiBBc3luY1Byb3h5TWFzdGVyQ2xvc3VyZSgpIHtcclxuICAgIHZhciBjYWxsSWQgPSAwO1xyXG4gICAgdmFyIGlzR2V0TWFzdGVyRW50cnlVcmxDYWxsZWQgPSBmYWxzZTtcclxuICAgIHZhciBtYXN0ZXJFbnRyeVVybCA9IGdldEJhc2VVcmxGcm9tRW50cnlTY3JpcHQoKTtcclxuICAgIFxyXG4gICAgZnVuY3Rpb24gQXN5bmNQcm94eU1hc3RlcihzY3JpcHRzVG9JbXBvcnQsIGN0b3JOYW1lLCBjdG9yQXJncywgb3B0aW9ucykge1xyXG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgICAgICBcclxuICAgICAgICB0aGF0Ll9jYWxsYmFja3MgPSBbXTtcclxuICAgICAgICB0aGF0Ll9wZW5kaW5nUHJvbWlzZUNhbGxzID0gW107XHJcbiAgICAgICAgdGhhdC5fc3ViV29ya2VyQnlJZCA9IFtdO1xyXG4gICAgICAgIHRoYXQuX3N1YldvcmtlcnMgPSBbXTtcclxuICAgICAgICB0aGF0Ll91c2VyRGF0YUhhbmRsZXIgPSBudWxsO1xyXG4gICAgICAgIHRoYXQuX25vdFJldHVybmVkRnVuY3Rpb25zID0gMDtcclxuICAgICAgICB0aGF0Ll9mdW5jdGlvbnNCdWZmZXJTaXplID0gb3B0aW9ucy5mdW5jdGlvbnNCdWZmZXJTaXplIHx8IDU7XHJcbiAgICAgICAgdGhhdC5fcGVuZGluZ01lc3NhZ2VzID0gW107XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHNjcmlwdE5hbWUgPSBnZXRTY3JpcHROYW1lKCk7XHJcbiAgICAgICAgdmFyIHNsYXZlU2NyaXB0Q29udGVudFN0cmluZyA9IG1haW5TbGF2ZVNjcmlwdENvbnRlbnQudG9TdHJpbmcoKTtcclxuICAgICAgICBzbGF2ZVNjcmlwdENvbnRlbnRTdHJpbmcgPSBzbGF2ZVNjcmlwdENvbnRlbnRTdHJpbmcucmVwbGFjZShcclxuICAgICAgICAgICAgJ1NDUklQVF9QTEFDRUhPTERFUicsIHNjcmlwdE5hbWUpO1xyXG4gICAgICAgIHZhciBzbGF2ZVNjcmlwdENvbnRlbnRCbG9iID0gbmV3IEJsb2IoXHJcbiAgICAgICAgICAgIFsnKCcsIHNsYXZlU2NyaXB0Q29udGVudFN0cmluZywgJykoKSddLFxyXG4gICAgICAgICAgICB7IHR5cGU6ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0JyB9KTtcclxuICAgICAgICB2YXIgc2xhdmVTY3JpcHRVcmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKHNsYXZlU2NyaXB0Q29udGVudEJsb2IpO1xyXG5cclxuICAgICAgICB0aGF0Ll93b3JrZXIgPSBuZXcgV29ya2VyKHNsYXZlU2NyaXB0VXJsKTtcclxuICAgICAgICB0aGF0Ll93b3JrZXIub25tZXNzYWdlID0gb25Xb3JrZXJNZXNzYWdlSW50ZXJuYWw7XHJcblxyXG4gICAgICAgIHRoYXQuX3dvcmtlci5wb3N0TWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uVG9DYWxsOiAnY3RvcicsXHJcbiAgICAgICAgICAgIHNjcmlwdHNUb0ltcG9ydDogc2NyaXB0c1RvSW1wb3J0LFxyXG4gICAgICAgICAgICBjdG9yTmFtZTogY3Rvck5hbWUsXHJcbiAgICAgICAgICAgIGFyZ3M6IGN0b3JBcmdzLFxyXG4gICAgICAgICAgICBjYWxsSWQ6ICsrY2FsbElkLFxyXG4gICAgICAgICAgICBpc1Byb21pc2U6IGZhbHNlLFxyXG4gICAgICAgICAgICBtYXN0ZXJFbnRyeVVybDogQXN5bmNQcm94eU1hc3Rlci5nZXRFbnRyeVVybCgpXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZnVuY3Rpb24gb25Xb3JrZXJNZXNzYWdlSW50ZXJuYWwod29ya2VyRXZlbnQpIHtcclxuICAgICAgICAgICAgb25Xb3JrZXJNZXNzYWdlKHRoYXQsIHdvcmtlckV2ZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIEFzeW5jUHJveHlNYXN0ZXIucHJvdG90eXBlLnNldFVzZXJEYXRhSGFuZGxlciA9IGZ1bmN0aW9uIHNldFVzZXJEYXRhSGFuZGxlcih1c2VyRGF0YUhhbmRsZXIpIHtcclxuICAgICAgICB0aGlzLl91c2VyRGF0YUhhbmRsZXIgPSB1c2VyRGF0YUhhbmRsZXI7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBBc3luY1Byb3h5TWFzdGVyLnByb3RvdHlwZS50ZXJtaW5hdGUgPSBmdW5jdGlvbiB0ZXJtaW5hdGUoKSB7XHJcbiAgICAgICAgdGhpcy5fd29ya2VyLnRlcm1pbmF0ZSgpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5fc3ViV29ya2Vycy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICB0aGlzLl9zdWJXb3JrZXJzW2ldLnRlcm1pbmF0ZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIEFzeW5jUHJveHlNYXN0ZXIucHJvdG90eXBlLmNhbGxGdW5jdGlvbiA9IGZ1bmN0aW9uIGNhbGxGdW5jdGlvbihmdW5jdGlvblRvQ2FsbCwgYXJncywgb3B0aW9ucykge1xyXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG4gICAgICAgIHZhciBpc1JldHVyblByb21pc2UgPSAhIW9wdGlvbnMuaXNSZXR1cm5Qcm9taXNlO1xyXG4gICAgICAgIHZhciB0cmFuc2ZlcmFibGVzQXJnID0gb3B0aW9ucy50cmFuc2ZlcmFibGVzIHx8IFtdO1xyXG4gICAgICAgIHZhciBwYXRoc1RvVHJhbnNmZXJhYmxlcyA9XHJcbiAgICAgICAgICAgIG9wdGlvbnMucGF0aHNUb1RyYW5zZmVyYWJsZXNJblByb21pc2VSZXN1bHQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGxvY2FsQ2FsbElkID0gKytjYWxsSWQ7XHJcbiAgICAgICAgdmFyIHByb21pc2VPbk1hc3RlclNpZGUgPSBudWxsO1xyXG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaXNSZXR1cm5Qcm9taXNlKSB7XHJcbiAgICAgICAgICAgIHByb21pc2VPbk1hc3RlclNpZGUgPSBuZXcgUHJvbWlzZShmdW5jdGlvbiBwcm9taXNlRnVuYyhyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgICAgIHRoYXQuX3BlbmRpbmdQcm9taXNlQ2FsbHNbbG9jYWxDYWxsSWRdID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmU6IHJlc29sdmUsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0OiByZWplY3RcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgc2VuZE1lc3NhZ2VGdW5jdGlvbiA9IG9wdGlvbnMuaXNTZW5kSW1tZWRpYXRlbHkgP1xyXG4gICAgICAgICAgICBzZW5kTWVzc2FnZVRvU2xhdmU6IGVucXVldWVNZXNzYWdlVG9TbGF2ZTtcclxuXHRcdFxyXG5cdFx0dmFyIHRyYW5zZmVyYWJsZXM7XHJcblx0XHRpZiAodHlwZW9mIHRyYW5zZmVyYWJsZXNBcmcgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0dHJhbnNmZXJhYmxlcyA9IHRyYW5zZmVyYWJsZXNBcmcoKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRyYW5zZmVyYWJsZXMgPSBBc3luY1Byb3h5TWFzdGVyLl9leHRyYWN0VHJhbnNmZXJhYmxlcyhcclxuXHRcdFx0XHR0cmFuc2ZlcmFibGVzQXJnLCBhcmdzKTtcclxuXHRcdH1cclxuICAgICAgICBcclxuICAgICAgICBzZW5kTWVzc2FnZUZ1bmN0aW9uKHRoaXMsIHRyYW5zZmVyYWJsZXMsIC8qaXNGdW5jdGlvbkNhbGw9Ki90cnVlLCB7XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uVG9DYWxsOiBmdW5jdGlvblRvQ2FsbCxcclxuICAgICAgICAgICAgYXJnczogYXJncyB8fCBbXSxcclxuICAgICAgICAgICAgY2FsbElkOiBsb2NhbENhbGxJZCxcclxuICAgICAgICAgICAgaXNQcm9taXNlOiBpc1JldHVyblByb21pc2UsXHJcbiAgICAgICAgICAgIHBhdGhzVG9UcmFuc2ZlcmFibGVzSW5Qcm9taXNlUmVzdWx0IDogcGF0aHNUb1RyYW5zZmVyYWJsZXNcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaXNSZXR1cm5Qcm9taXNlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlT25NYXN0ZXJTaWRlO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIEFzeW5jUHJveHlNYXN0ZXIucHJvdG90eXBlLndyYXBDYWxsYmFjayA9IGZ1bmN0aW9uIHdyYXBDYWxsYmFjayhcclxuICAgICAgICBjYWxsYmFjaywgY2FsbGJhY2tOYW1lLCBvcHRpb25zKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgICAgICAgdmFyIGxvY2FsQ2FsbElkID0gKytjYWxsSWQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNhbGxiYWNrSGFuZGxlID0ge1xyXG4gICAgICAgICAgICBpc1dvcmtlckhlbHBlckNhbGxiYWNrOiB0cnVlLFxyXG4gICAgICAgICAgICBpc011bHRpcGxlVGltZUNhbGxiYWNrOiAhIW9wdGlvbnMuaXNNdWx0aXBsZVRpbWVDYWxsYmFjayxcclxuICAgICAgICAgICAgY2FsbElkOiBsb2NhbENhbGxJZCxcclxuICAgICAgICAgICAgY2FsbGJhY2tOYW1lOiBjYWxsYmFja05hbWUsXHJcbiAgICAgICAgICAgIHBhdGhzVG9UcmFuc2ZlcmFibGVzOiBvcHRpb25zLnBhdGhzVG9UcmFuc2ZlcmFibGVzXHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaW50ZXJuYWxDYWxsYmFja0hhbmRsZSA9IHtcclxuICAgICAgICAgICAgaXNNdWx0aXBsZVRpbWVDYWxsYmFjazogISFvcHRpb25zLmlzTXVsdGlwbGVUaW1lQ2FsbGJhY2ssXHJcbiAgICAgICAgICAgIGNhbGxJZDogbG9jYWxDYWxsSWQsXHJcbiAgICAgICAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcclxuICAgICAgICAgICAgcGF0aHNUb1RyYW5zZmVyYWJsZXM6IG9wdGlvbnMucGF0aHNUb1RyYW5zZmVyYWJsZXNcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrc1tsb2NhbENhbGxJZF0gPSBpbnRlcm5hbENhbGxiYWNrSGFuZGxlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBjYWxsYmFja0hhbmRsZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEFzeW5jUHJveHlNYXN0ZXIucHJvdG90eXBlLmZyZWVDYWxsYmFjayA9IGZ1bmN0aW9uIGZyZWVDYWxsYmFjayhjYWxsYmFja0hhbmRsZSkge1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbY2FsbGJhY2tIYW5kbGUuY2FsbElkXTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIFN0YXRpYyBmdW5jdGlvbnNcclxuICAgIFxyXG4gICAgQXN5bmNQcm94eU1hc3Rlci5nZXRFbnRyeVVybCA9IGZ1bmN0aW9uIGdldEVudHJ5VXJsKCkge1xyXG4gICAgICAgIGlzR2V0TWFzdGVyRW50cnlVcmxDYWxsZWQgPSB0cnVlO1xyXG4gICAgICAgIHJldHVybiBtYXN0ZXJFbnRyeVVybDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEFzeW5jUHJveHlNYXN0ZXIuX3NldEVudHJ5VXJsID0gZnVuY3Rpb24gc2V0RW50cnlVcmwobmV3VXJsKSB7XHJcbiAgICAgICAgaWYgKG1hc3RlckVudHJ5VXJsICE9PSBuZXdVcmwgJiYgaXNHZXRNYXN0ZXJFbnRyeVVybENhbGxlZCkge1xyXG4gICAgICAgICAgICB0aHJvdyAnUHJldmlvdXMgdmFsdWVzIHJldHVybmVkIGZyb20gZ2V0TWFzdGVyRW50cnlVcmwgJyArXHJcbiAgICAgICAgICAgICAgICAnaXMgd3JvbmcuIEF2b2lkIGNhbGxpbmcgaXQgd2l0aGluIHRoZSBzbGF2ZSBjYHRvcic7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBtYXN0ZXJFbnRyeVVybCA9IG5ld1VybDtcclxuICAgIH07XHJcblx0XHJcblx0QXN5bmNQcm94eU1hc3Rlci5fZXh0cmFjdFRyYW5zZmVyYWJsZXMgPSBmdW5jdGlvbiBleHRyYWN0VHJhbnNmZXJhYmxlcyhcclxuXHRcdFx0cGF0aHNUb1RyYW5zZmVyYWJsZXMsIHBhdGhzQmFzZSkge1xyXG5cdFx0XHJcbiAgICAgICAgaWYgKHBhdGhzVG9UcmFuc2ZlcmFibGVzID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRyYW5zZmVyYWJsZXMgPSBuZXcgQXJyYXkocGF0aHNUb1RyYW5zZmVyYWJsZXMubGVuZ3RoKTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhdGhzVG9UcmFuc2ZlcmFibGVzLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBwYXRoID0gcGF0aHNUb1RyYW5zZmVyYWJsZXNbaV07XHJcbiAgICAgICAgICAgIHZhciB0cmFuc2ZlcmFibGUgPSBwYXRoc0Jhc2U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHBhdGgubGVuZ3RoOyArK2opIHtcclxuICAgICAgICAgICAgICAgIHZhciBtZW1iZXIgPSBwYXRoW2pdO1xyXG4gICAgICAgICAgICAgICAgdHJhbnNmZXJhYmxlID0gdHJhbnNmZXJhYmxlW21lbWJlcl07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRyYW5zZmVyYWJsZXNbaV0gPSB0cmFuc2ZlcmFibGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0cmFuc2ZlcmFibGVzO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gUHJpdmF0ZSBmdW5jdGlvbnNcclxuXHRcclxuXHRmdW5jdGlvbiBnZXRTY3JpcHROYW1lKCkge1xyXG4gICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcigpO1xyXG5cdFx0cmV0dXJuIFNjcmlwdHNUb0ltcG9ydFBvb2wuX2dldFNjcmlwdE5hbWUoZXJyb3IpO1xyXG5cdH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gbWFpblNsYXZlU2NyaXB0Q29udGVudCgpIHtcclxuXHRcdC8vIFRoaXMgZnVuY3Rpb24gaXMgbm90IHJ1biBkaXJlY3RseTogSXQgY29waWVkIGFzIGEgc3RyaW5nIGludG8gYSBibG9iXHJcblx0XHQvLyBhbmQgcnVuIGluIHRoZSBXZWIgV29ya2VyIGdsb2JhbCBzY29wZVxyXG5cdFx0XHJcblx0XHQvKiBnbG9iYWwgaW1wb3J0U2NyaXB0czogZmFsc2UgKi9cclxuICAgICAgICBpbXBvcnRTY3JpcHRzKCdTQ1JJUFRfUExBQ0VIT0xERVInKTtcclxuXHRcdC8qIGdsb2JhbCBhc3luY1Byb3h5OiBmYWxzZSAqL1xyXG4gICAgICAgIGFzeW5jUHJveHkuQXN5bmNQcm94eVNsYXZlLl9pbml0aWFsaXplU2xhdmUoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gb25Xb3JrZXJNZXNzYWdlKHRoYXQsIHdvcmtlckV2ZW50KSB7XHJcbiAgICAgICAgdmFyIGNhbGxJZCA9IHdvcmtlckV2ZW50LmRhdGEuY2FsbElkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN3aXRjaCAod29ya2VyRXZlbnQuZGF0YS50eXBlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ2Z1bmN0aW9uQ2FsbGVkJzpcclxuICAgICAgICAgICAgICAgIC0tdGhhdC5fbm90UmV0dXJuZWRGdW5jdGlvbnM7XHJcbiAgICAgICAgICAgICAgICB0cnlTZW5kUGVuZGluZ01lc3NhZ2VzKHRoYXQpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjYXNlICdwcm9taXNlUmVzdWx0JzpcclxuICAgICAgICAgICAgICAgIHZhciBwcm9taXNlVG9SZXNvbHZlID0gdGhhdC5fcGVuZGluZ1Byb21pc2VDYWxsc1tjYWxsSWRdO1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoYXQuX3BlbmRpbmdQcm9taXNlQ2FsbHNbY2FsbElkXTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHdvcmtlckV2ZW50LmRhdGEucmVzdWx0O1xyXG4gICAgICAgICAgICAgICAgcHJvbWlzZVRvUmVzb2x2ZS5yZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FzZSAncHJvbWlzZUZhaWx1cmUnOlxyXG4gICAgICAgICAgICAgICAgdmFyIHByb21pc2VUb1JlamVjdCA9IHRoYXQuX3BlbmRpbmdQcm9taXNlQ2FsbHNbY2FsbElkXTtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGF0Ll9wZW5kaW5nUHJvbWlzZUNhbGxzW2NhbGxJZF07XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciByZWFzb24gPSB3b3JrZXJFdmVudC5kYXRhLnJlYXNvbjtcclxuICAgICAgICAgICAgICAgIHByb21pc2VUb1JlamVjdC5yZWplY3QocmVhc29uKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjYXNlICd1c2VyRGF0YSc6XHJcbiAgICAgICAgICAgICAgICBpZiAodGhhdC5fdXNlckRhdGFIYW5kbGVyICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5fdXNlckRhdGFIYW5kbGVyKHdvcmtlckV2ZW50LmRhdGEudXNlckRhdGEpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhc2UgJ2NhbGxiYWNrJzpcclxuICAgICAgICAgICAgICAgIHZhciBjYWxsYmFja0hhbmRsZSA9IHRoYXQuX2NhbGxiYWNrc1t3b3JrZXJFdmVudC5kYXRhLmNhbGxJZF07XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2tIYW5kbGUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93ICdVbmV4cGVjdGVkIG1lc3NhZ2UgZnJvbSBTbGF2ZVdvcmtlciBvZiBjYWxsYmFjayBJRDogJyArXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdvcmtlckV2ZW50LmRhdGEuY2FsbElkICsgJy4gTWF5YmUgc2hvdWxkIGluZGljYXRlICcgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnaXNNdWx0aXBsZVRpbWVzQ2FsbGJhY2sgPSB0cnVlIG9uIGNyZWF0aW9uPyc7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICghY2FsbGJhY2tIYW5kbGUuaXNNdWx0aXBsZVRpbWVDYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoYXQuZnJlZUNhbGxiYWNrKHRoYXQuX2NhbGxiYWNrc1t3b3JrZXJFdmVudC5kYXRhLmNhbGxJZF0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2tIYW5kbGUuY2FsbGJhY2sgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFja0hhbmRsZS5jYWxsYmFjay5hcHBseShudWxsLCB3b3JrZXJFdmVudC5kYXRhLmFyZ3MpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhc2UgJ3N1YldvcmtlckN0b3InOlxyXG4gICAgICAgICAgICAgICAgdmFyIHN1YldvcmtlckNyZWF0ZWQgPSBuZXcgV29ya2VyKHdvcmtlckV2ZW50LmRhdGEuc2NyaXB0VXJsKTtcclxuICAgICAgICAgICAgICAgIHZhciBpZCA9IHdvcmtlckV2ZW50LmRhdGEuc3ViV29ya2VySWQ7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHRoYXQuX3N1YldvcmtlckJ5SWRbaWRdID0gc3ViV29ya2VyQ3JlYXRlZDtcclxuICAgICAgICAgICAgICAgIHRoYXQuX3N1YldvcmtlcnMucHVzaChzdWJXb3JrZXJDcmVhdGVkKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgc3ViV29ya2VyQ3JlYXRlZC5vbm1lc3NhZ2UgPSBmdW5jdGlvbiBvblN1Yldvcmtlck1lc3NhZ2Uoc3ViV29ya2VyRXZlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICBlbnF1ZXVlTWVzc2FnZVRvU2xhdmUoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQsIHN1YldvcmtlckV2ZW50LnBvcnRzLCAvKmlzRnVuY3Rpb25DYWxsPSovZmFsc2UsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uVG9DYWxsOiAnc3ViV29ya2VyT25NZXNzYWdlJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YldvcmtlcklkOiBpZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHN1YldvcmtlckV2ZW50LmRhdGFcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNhc2UgJ3N1YldvcmtlclBvc3RNZXNzYWdlJzpcclxuICAgICAgICAgICAgICAgIHZhciBzdWJXb3JrZXJUb1Bvc3RNZXNzYWdlID0gdGhhdC5fc3ViV29ya2VyQnlJZFt3b3JrZXJFdmVudC5kYXRhLnN1YldvcmtlcklkXTtcclxuICAgICAgICAgICAgICAgIHN1YldvcmtlclRvUG9zdE1lc3NhZ2UucG9zdE1lc3NhZ2Uod29ya2VyRXZlbnQuZGF0YS5kYXRhKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FzZSAnc3ViV29ya2VyVGVybWluYXRlJzpcclxuICAgICAgICAgICAgICAgIHZhciBzdWJXb3JrZXJUb1Rlcm1pbmF0ZSA9IHRoYXQuX3N1YldvcmtlckJ5SWRbd29ya2VyRXZlbnQuZGF0YS5zdWJXb3JrZXJJZF07XHJcbiAgICAgICAgICAgICAgICBzdWJXb3JrZXJUb1Rlcm1pbmF0ZS50ZXJtaW5hdGUoKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93ICdVbmtub3duIG1lc3NhZ2UgZnJvbSBBc3luY1Byb3h5U2xhdmUgb2YgdHlwZTogJyArXHJcbiAgICAgICAgICAgICAgICAgICAgd29ya2VyRXZlbnQuZGF0YS50eXBlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZW5xdWV1ZU1lc3NhZ2VUb1NsYXZlKFxyXG4gICAgICAgIHRoYXQsIHRyYW5zZmVyYWJsZXMsIGlzRnVuY3Rpb25DYWxsLCBtZXNzYWdlKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoYXQuX25vdFJldHVybmVkRnVuY3Rpb25zID49IHRoYXQuX2Z1bmN0aW9uc0J1ZmZlclNpemUpIHtcclxuICAgICAgICAgICAgdGhhdC5fcGVuZGluZ01lc3NhZ2VzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgdHJhbnNmZXJhYmxlczogdHJhbnNmZXJhYmxlcyxcclxuICAgICAgICAgICAgICAgIGlzRnVuY3Rpb25DYWxsOiBpc0Z1bmN0aW9uQ2FsbCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2VuZE1lc3NhZ2VUb1NsYXZlKHRoYXQsIHRyYW5zZmVyYWJsZXMsIGlzRnVuY3Rpb25DYWxsLCBtZXNzYWdlKTtcclxuICAgIH1cclxuICAgICAgICBcclxuICAgIGZ1bmN0aW9uIHNlbmRNZXNzYWdlVG9TbGF2ZShcclxuICAgICAgICB0aGF0LCB0cmFuc2ZlcmFibGVzLCBpc0Z1bmN0aW9uQ2FsbCwgbWVzc2FnZSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpc0Z1bmN0aW9uQ2FsbCkge1xyXG4gICAgICAgICAgICArK3RoYXQuX25vdFJldHVybmVkRnVuY3Rpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB0aGF0Ll93b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSwgdHJhbnNmZXJhYmxlcyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIHRyeVNlbmRQZW5kaW5nTWVzc2FnZXModGhhdCkge1xyXG4gICAgICAgIHdoaWxlICh0aGF0Ll9ub3RSZXR1cm5lZEZ1bmN0aW9ucyA8IHRoYXQuX2Z1bmN0aW9uc0J1ZmZlclNpemUgJiZcclxuICAgICAgICAgICAgICAgdGhhdC5fcGVuZGluZ01lc3NhZ2VzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBtZXNzYWdlID0gdGhhdC5fcGVuZGluZ01lc3NhZ2VzLnNoaWZ0KCk7XHJcbiAgICAgICAgICAgIHNlbmRNZXNzYWdlVG9TbGF2ZShcclxuICAgICAgICAgICAgICAgIHRoYXQsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlLnRyYW5zZmVyYWJsZXMsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmlzRnVuY3Rpb25DYWxsLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZS5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldEJhc2VVcmxGcm9tRW50cnlTY3JpcHQoKSB7XHJcbiAgICAgICAgdmFyIGJhc2VVcmwgPSBsb2NhdGlvbi5ocmVmO1xyXG4gICAgICAgIHZhciBlbmRPZlBhdGggPSBiYXNlVXJsLmxhc3RJbmRleE9mKCcvJyk7XHJcbiAgICAgICAgaWYgKGVuZE9mUGF0aCA+PSAwKSB7XHJcbiAgICAgICAgICAgIGJhc2VVcmwgPSBiYXNlVXJsLnN1YnN0cmluZygwLCBlbmRPZlBhdGgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gYmFzZVVybDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIEFzeW5jUHJveHlNYXN0ZXI7XHJcbn0pKCk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEFzeW5jUHJveHlNYXN0ZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuLyogZ2xvYmFsIGNvbnNvbGU6IGZhbHNlICovXHJcbi8qIGdsb2JhbCBzZWxmOiBmYWxzZSAqL1xyXG5cclxudmFyIEFzeW5jUHJveHlNYXN0ZXIgPSByZXF1aXJlKCdhc3luYy1wcm94eS1tYXN0ZXInKTtcclxudmFyIFN1YldvcmtlckVtdWxhdGlvbkZvckNocm9tZSA9IHJlcXVpcmUoJ3N1Yi13b3JrZXItZW11bGF0aW9uLWZvci1jaHJvbWUnKTtcclxuXHJcbnZhciBBc3luY1Byb3h5U2xhdmUgPSAoZnVuY3Rpb24gQXN5bmNQcm94eVNsYXZlQ2xvc3VyZSgpIHtcclxuICAgIHZhciBzbGF2ZUhlbHBlclNpbmdsZXRvbiA9IHt9O1xyXG4gICAgXHJcbiAgICB2YXIgYmVmb3JlT3BlcmF0aW9uTGlzdGVuZXIgPSBudWxsO1xyXG4gICAgdmFyIHNsYXZlU2lkZU1haW5JbnN0YW5jZTtcclxuICAgIHZhciBzbGF2ZVNpZGVJbnN0YW5jZUNyZWF0b3IgPSBkZWZhdWx0SW5zdGFuY2VDcmVhdG9yO1xyXG4gICAgdmFyIHN1YldvcmtlcklkVG9TdWJXb3JrZXIgPSB7fTtcclxuICAgIHZhciBjdG9yTmFtZTtcclxuICAgIFxyXG4gICAgc2xhdmVIZWxwZXJTaW5nbGV0b24uX2luaXRpYWxpemVTbGF2ZSA9IGZ1bmN0aW9uIGluaXRpYWxpemVTbGF2ZSgpIHtcclxuICAgICAgICBzZWxmLm9ubWVzc2FnZSA9IG9uTWVzc2FnZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHNsYXZlSGVscGVyU2luZ2xldG9uLnNldFNsYXZlU2lkZUNyZWF0b3IgPSBmdW5jdGlvbiBzZXRTbGF2ZVNpZGVDcmVhdG9yKGNyZWF0b3IpIHtcclxuICAgICAgICBzbGF2ZVNpZGVJbnN0YW5jZUNyZWF0b3IgPSBjcmVhdG9yO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgc2xhdmVIZWxwZXJTaW5nbGV0b24uc2V0QmVmb3JlT3BlcmF0aW9uTGlzdGVuZXIgPVxyXG4gICAgICAgIGZ1bmN0aW9uIHNldEJlZm9yZU9wZXJhdGlvbkxpc3RlbmVyKGxpc3RlbmVyKSB7XHJcbiAgICAgICAgICAgIGJlZm9yZU9wZXJhdGlvbkxpc3RlbmVyID0gbGlzdGVuZXI7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgIHNsYXZlSGVscGVyU2luZ2xldG9uLnNlbmRVc2VyRGF0YVRvTWFzdGVyID0gZnVuY3Rpb24gc2VuZFVzZXJEYXRhVG9NYXN0ZXIoXHJcbiAgICAgICAgdXNlckRhdGEpIHtcclxuICAgICAgICBcclxuICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHtcclxuICAgICAgICAgICAgdHlwZTogJ3VzZXJEYXRhJyxcclxuICAgICAgICAgICAgdXNlckRhdGE6IHVzZXJEYXRhXHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBzbGF2ZUhlbHBlclNpbmdsZXRvbi53cmFwUHJvbWlzZUZyb21TbGF2ZVNpZGUgPVxyXG4gICAgICAgIGZ1bmN0aW9uIHdyYXBQcm9taXNlRnJvbVNsYXZlU2lkZShcclxuICAgICAgICAgICAgY2FsbElkLCBwcm9taXNlLCBwYXRoc1RvVHJhbnNmZXJhYmxlcykge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBwcm9taXNlVGhlbiA9IHByb21pc2UudGhlbihmdW5jdGlvbiBzZW5kUHJvbWlzZVRvTWFzdGVyKHJlc3VsdCkge1xyXG4gICAgICAgICAgICB2YXIgdHJhbnNmZXJhYmxlcyA9XHJcblx0XHRcdFx0QXN5bmNQcm94eU1hc3Rlci5fZXh0cmFjdFRyYW5zZmVyYWJsZXMoXHJcblx0XHRcdFx0XHRwYXRoc1RvVHJhbnNmZXJhYmxlcywgcmVzdWx0KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHNlbGYucG9zdE1lc3NhZ2UoXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Byb21pc2VSZXN1bHQnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxJZDogY2FsbElkLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdDogcmVzdWx0XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgdHJhbnNmZXJhYmxlcyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcHJvbWlzZVRoZW5bJ2NhdGNoJ10oZnVuY3Rpb24gc2VuZEZhaWx1cmVUb01hc3RlcihyZWFzb24pIHtcclxuICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAncHJvbWlzZUZhaWx1cmUnLFxyXG4gICAgICAgICAgICAgICAgY2FsbElkOiBjYWxsSWQsXHJcbiAgICAgICAgICAgICAgICByZWFzb246IHJlYXNvblxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHNsYXZlSGVscGVyU2luZ2xldG9uLndyYXBDYWxsYmFja0Zyb21TbGF2ZVNpZGUgPVxyXG4gICAgICAgIGZ1bmN0aW9uIHdyYXBDYWxsYmFja0Zyb21TbGF2ZVNpZGUoY2FsbGJhY2tIYW5kbGUpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgdmFyIGlzQWxyZWFkeUNhbGxlZCA9IGZhbHNlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZ1bmN0aW9uIGNhbGxiYWNrV3JhcHBlckZyb21TbGF2ZVNpZGUoKSB7XHJcbiAgICAgICAgICAgIGlmIChpc0FscmVhZHlDYWxsZWQpIHtcclxuICAgICAgICAgICAgICAgIHRocm93ICdDYWxsYmFjayBpcyBjYWxsZWQgdHdpY2UgYnV0IGlzTXVsdGlwbGVUaW1lQ2FsbGJhY2sgJyArXHJcbiAgICAgICAgICAgICAgICAgICAgJz0gZmFsc2UnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgYXJndW1lbnRzQXNBcnJheSA9IGdldEFyZ3VtZW50c0FzQXJyYXkoYXJndW1lbnRzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChiZWZvcmVPcGVyYXRpb25MaXN0ZW5lciAhPT0gbnVsbCkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRiZWZvcmVPcGVyYXRpb25MaXN0ZW5lci5jYWxsKFxyXG5cdFx0XHRcdFx0XHRzbGF2ZVNpZGVNYWluSW5zdGFuY2UsXHJcblx0XHRcdFx0XHRcdCdjYWxsYmFjaycsXHJcblx0XHRcdFx0XHRcdGNhbGxiYWNrSGFuZGxlLmNhbGxiYWNrTmFtZSxcclxuXHRcdFx0XHRcdFx0YXJndW1lbnRzQXNBcnJheSk7XHJcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0FzeW5jUHJveHlTbGF2ZS5iZWZvcmVPcGVyYXRpb25MaXN0ZW5lciBoYXMgdGhyb3duIGFuIGV4Y2VwdGlvbjogJyArIGUpO1xyXG5cdFx0XHRcdH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHRyYW5zZmVyYWJsZXMgPVxyXG5cdFx0XHRcdEFzeW5jUHJveHlNYXN0ZXIuX2V4dHJhY3RUcmFuc2ZlcmFibGVzKFxyXG5cdFx0XHRcdFx0Y2FsbGJhY2tIYW5kbGUucGF0aHNUb1RyYW5zZmVyYWJsZXMsIGFyZ3VtZW50c0FzQXJyYXkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NhbGxiYWNrJyxcclxuICAgICAgICAgICAgICAgICAgICBjYWxsSWQ6IGNhbGxiYWNrSGFuZGxlLmNhbGxJZCxcclxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBhcmd1bWVudHNBc0FycmF5XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgdHJhbnNmZXJhYmxlcyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWNhbGxiYWNrSGFuZGxlLmlzTXVsdGlwbGVUaW1lQ2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIGlzQWxyZWFkeUNhbGxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrV3JhcHBlckZyb21TbGF2ZVNpZGU7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UoZXZlbnQpIHtcclxuICAgICAgICB2YXIgZnVuY3Rpb25OYW1lVG9DYWxsID0gZXZlbnQuZGF0YS5mdW5jdGlvblRvQ2FsbDtcclxuICAgICAgICB2YXIgYXJncyA9IGV2ZW50LmRhdGEuYXJncztcclxuICAgICAgICB2YXIgY2FsbElkID0gZXZlbnQuZGF0YS5jYWxsSWQ7XHJcbiAgICAgICAgdmFyIGlzUHJvbWlzZSA9IGV2ZW50LmRhdGEuaXNQcm9taXNlO1xyXG4gICAgICAgIHZhciBwYXRoc1RvVHJhbnNmZXJhYmxlc0luUHJvbWlzZVJlc3VsdCA9XHJcbiAgICAgICAgICAgIGV2ZW50LmRhdGEucGF0aHNUb1RyYW5zZmVyYWJsZXNJblByb21pc2VSZXN1bHQ7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChmdW5jdGlvbk5hbWVUb0NhbGwpIHtcclxuICAgICAgICAgICAgY2FzZSAnY3Rvcic6XHJcbiAgICAgICAgICAgICAgICBBc3luY1Byb3h5TWFzdGVyLl9zZXRFbnRyeVVybChldmVudC5kYXRhLm1hc3RlckVudHJ5VXJsKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIHNjcmlwdHNUb0ltcG9ydCA9IGV2ZW50LmRhdGEuc2NyaXB0c1RvSW1wb3J0O1xyXG4gICAgICAgICAgICAgICAgY3Rvck5hbWUgPSBldmVudC5kYXRhLmN0b3JOYW1lO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNjcmlwdHNUb0ltcG9ydC5sZW5ndGg7ICsraSkge1xyXG5cdFx0XHRcdFx0LyogZ2xvYmFsIGltcG9ydFNjcmlwdHM6IGZhbHNlICovXHJcbiAgICAgICAgICAgICAgICAgICAgaW1wb3J0U2NyaXB0cyhzY3JpcHRzVG9JbXBvcnRbaV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBzbGF2ZVNpZGVNYWluSW5zdGFuY2UgPSBzbGF2ZVNpZGVJbnN0YW5jZUNyZWF0b3IuYXBwbHkobnVsbCwgYXJncyk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY2FzZSAnc3ViV29ya2VyT25NZXNzYWdlJzpcclxuICAgICAgICAgICAgICAgIHZhciBzdWJXb3JrZXIgPSBzdWJXb3JrZXJJZFRvU3ViV29ya2VyW2V2ZW50LmRhdGEuc3ViV29ya2VySWRdO1xyXG4gICAgICAgICAgICAgICAgdmFyIHdvcmtlckV2ZW50ID0geyBkYXRhOiBldmVudC5kYXRhLmRhdGEgfTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgc3ViV29ya2VyLm9ubWVzc2FnZSh3b3JrZXJFdmVudCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShldmVudC5kYXRhLmFyZ3MubGVuZ3RoKTtcclxuICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8IGV2ZW50LmRhdGEuYXJncy5sZW5ndGg7ICsraikge1xyXG4gICAgICAgICAgICB2YXIgYXJnID0gZXZlbnQuZGF0YS5hcmdzW2pdO1xyXG4gICAgICAgICAgICBpZiAoYXJnICE9PSB1bmRlZmluZWQgJiZcclxuICAgICAgICAgICAgICAgIGFyZyAhPT0gbnVsbCAmJlxyXG4gICAgICAgICAgICAgICAgYXJnLmlzV29ya2VySGVscGVyQ2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYXJnID0gc2xhdmVIZWxwZXJTaW5nbGV0b24ud3JhcENhbGxiYWNrRnJvbVNsYXZlU2lkZShhcmcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhcmdzW2pdID0gYXJnO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgZnVuY3Rpb25Db250YWluZXIgPSBzbGF2ZVNpZGVNYWluSW5zdGFuY2U7XHJcbiAgICAgICAgdmFyIGZ1bmN0aW9uVG9DYWxsO1xyXG4gICAgICAgIHdoaWxlIChmdW5jdGlvbkNvbnRhaW5lcikge1xyXG4gICAgICAgICAgICBmdW5jdGlvblRvQ2FsbCA9IHNsYXZlU2lkZU1haW5JbnN0YW5jZVtmdW5jdGlvbk5hbWVUb0NhbGxdO1xyXG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25Ub0NhbGwpIHtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcblx0XHRcdC8qIGpzaGludCBwcm90bzogdHJ1ZSAqL1xyXG4gICAgICAgICAgICBmdW5jdGlvbkNvbnRhaW5lciA9IGZ1bmN0aW9uQ29udGFpbmVyLl9fcHJvdG9fXztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFmdW5jdGlvblRvQ2FsbCkge1xyXG4gICAgICAgICAgICB0aHJvdyAnQXN5bmNQcm94eSBlcnJvcjogY291bGQgbm90IGZpbmQgZnVuY3Rpb24gJyArIGZ1bmN0aW9uTmFtZVRvQ2FsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHByb21pc2UgPSBmdW5jdGlvblRvQ2FsbC5hcHBseShzbGF2ZVNpZGVNYWluSW5zdGFuY2UsIGFyZ3MpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChpc1Byb21pc2UpIHtcclxuICAgICAgICAgICAgc2xhdmVIZWxwZXJTaW5nbGV0b24ud3JhcFByb21pc2VGcm9tU2xhdmVTaWRlKFxyXG4gICAgICAgICAgICAgICAgY2FsbElkLCBwcm9taXNlLCBwYXRoc1RvVHJhbnNmZXJhYmxlc0luUHJvbWlzZVJlc3VsdCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHtcclxuICAgICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uQ2FsbGVkJyxcclxuICAgICAgICAgICAgY2FsbElkOiBldmVudC5kYXRhLmNhbGxJZCxcclxuICAgICAgICAgICAgcmVzdWx0OiByZXN1bHRcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZGVmYXVsdEluc3RhbmNlQ3JlYXRvcigpIHtcclxuICAgICAgICB2YXIgaW5zdGFuY2U7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdmFyIG5hbWVzcGFjZXNBbmRDdG9yTmFtZSA9IGN0b3JOYW1lLnNwbGl0KCcuJyk7XHJcbiAgICAgICAgICAgIHZhciBtZW1iZXIgPSBzZWxmO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5hbWVzcGFjZXNBbmRDdG9yTmFtZS5sZW5ndGg7ICsraSlcclxuICAgICAgICAgICAgICAgIG1lbWJlciA9IG1lbWJlcltuYW1lc3BhY2VzQW5kQ3Rvck5hbWVbaV1dO1xyXG4gICAgICAgICAgICB2YXIgVHlwZUN0b3IgPSBtZW1iZXI7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgYmluZEFyZ3MgPSBbbnVsbF0uY29uY2F0KGdldEFyZ3VtZW50c0FzQXJyYXkoYXJndW1lbnRzKSk7XHJcbiAgICAgICAgICAgIGluc3RhbmNlID0gbmV3IChGdW5jdGlvbi5wcm90b3R5cGUuYmluZC5hcHBseShUeXBlQ3RvciwgYmluZEFyZ3MpKSgpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgbG9jYXRpbmcgY2xhc3MgbmFtZSAnICsgY3Rvck5hbWUgKyAnOiAnICsgZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBpbnN0YW5jZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZnVuY3Rpb24gZ2V0QXJndW1lbnRzQXNBcnJheShhcmdzKSB7XHJcbiAgICAgICAgdmFyIGFyZ3VtZW50c0FzQXJyYXkgPSBuZXcgQXJyYXkoYXJncy5sZW5ndGgpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBhcmd1bWVudHNBc0FycmF5W2ldID0gYXJnc1tpXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGFyZ3VtZW50c0FzQXJyYXk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmIChzZWxmLldvcmtlciA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgU3ViV29ya2VyRW11bGF0aW9uRm9yQ2hyb21lLmluaXRpYWxpemUoc3ViV29ya2VySWRUb1N1Yldvcmtlcik7XHJcbiAgICAgICAgc2VsZi5Xb3JrZXIgPSBTdWJXb3JrZXJFbXVsYXRpb25Gb3JDaHJvbWU7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBzbGF2ZUhlbHBlclNpbmdsZXRvbjtcclxufSkoKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQXN5bmNQcm94eVNsYXZlOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBTY3JpcHRzVG9JbXBvcnRQb29sID0gKGZ1bmN0aW9uIFNjcmlwdHNUb0ltcG9ydFBvb2xDbG9zdXJlKCkge1xyXG5cdHZhciBjdXJyZW50U3RhY2tGcmFtZVJlZ2V4ID0gL2F0ICh8W14gXSsgXFwoKShbXiBdKyk6XFxkKzpcXGQrLztcclxuXHR2YXIgbGFzdFN0YWNrRnJhbWVSZWdleFdpdGhTdHJ1ZGVsID0gbmV3IFJlZ0V4cCgvLitAKC4qPyk6XFxkKzpcXGQrLyk7XHJcblx0dmFyIGxhc3RTdGFja0ZyYW1lUmVnZXggPSBuZXcgUmVnRXhwKC8uK1xcLyguKj8pOlxcZCsoOlxcZCspKiQvKTtcclxuXHJcbiAgICBmdW5jdGlvbiBTY3JpcHRzVG9JbXBvcnRQb29sKCkge1xyXG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICB0aGF0Ll9zY3JpcHRzQnlOYW1lID0ge307XHJcbiAgICAgICAgdGhhdC5fc2NyaXB0c0FycmF5ID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgU2NyaXB0c1RvSW1wb3J0UG9vbC5wcm90b3R5cGUuYWRkU2NyaXB0RnJvbUVycm9yV2l0aFN0YWNrVHJhY2UgPVxyXG4gICAgICAgIGZ1bmN0aW9uIGFkZFNjcmlwdEZvcldvcmtlckltcG9ydChlcnJvcldpdGhTdGFja1RyYWNlKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGZpbGVOYW1lID0gU2NyaXB0c1RvSW1wb3J0UG9vbC5fZ2V0U2NyaXB0TmFtZShlcnJvcldpdGhTdGFja1RyYWNlKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIXRoaXMuX3NjcmlwdHNCeU5hbWVbZmlsZU5hbWVdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3NjcmlwdHNCeU5hbWVbZmlsZU5hbWVdID0gdHJ1ZTtcclxuICAgICAgICAgICAgdGhpcy5fc2NyaXB0c0FycmF5ID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBTY3JpcHRzVG9JbXBvcnRQb29sLnByb3RvdHlwZS5nZXRTY3JpcHRzRm9yV29ya2VySW1wb3J0ID1cclxuICAgICAgICBmdW5jdGlvbiBnZXRTY3JpcHRzRm9yV29ya2VySW1wb3J0KCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLl9zY3JpcHRzQXJyYXkgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5fc2NyaXB0c0FycmF5ID0gW107XHJcbiAgICAgICAgICAgIGZvciAodmFyIGZpbGVOYW1lIGluIHRoaXMuX3NjcmlwdHNCeU5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmlwdHNBcnJheS5wdXNoKGZpbGVOYW1lKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdGhpcy5fc2NyaXB0c0FycmF5O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgU2NyaXB0c1RvSW1wb3J0UG9vbC5fZ2V0U2NyaXB0TmFtZSA9IGZ1bmN0aW9uIGdldFNjcmlwdE5hbWUoZXJyb3JXaXRoU3RhY2tUcmFjZSkge1xyXG4gICAgICAgIHZhciBzdGFjayA9IGVycm9yV2l0aFN0YWNrVHJhY2Uuc3RhY2sudHJpbSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzb3VyY2UgPSBjdXJyZW50U3RhY2tGcmFtZVJlZ2V4LmV4ZWMoc3RhY2spO1xyXG4gICAgICAgIGlmIChzb3VyY2UgJiYgc291cmNlWzJdICE9PSBcIlwiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBzb3VyY2VbMl07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBzb3VyY2UgPSBsYXN0U3RhY2tGcmFtZVJlZ2V4V2l0aFN0cnVkZWwuZXhlYyhzdGFjayk7XHJcblx0XHRpZiAoc291cmNlICYmIChzb3VyY2VbMV0gIT09IFwiXCIpKSB7XHJcblx0XHRcdHJldHVybiBzb3VyY2VbMV07XHJcblx0XHR9XHJcbiAgICAgICAgXHJcbiAgICAgICAgc291cmNlID0gbGFzdFN0YWNrRnJhbWVSZWdleC5leGVjKHN0YWNrKTtcclxuICAgICAgICBpZiAoc291cmNlICYmIHNvdXJjZVsxXSAhPT0gXCJcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gc291cmNlWzFdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoZXJyb3JXaXRoU3RhY2tUcmFjZS5maWxlTmFtZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvcldpdGhTdGFja1RyYWNlLmZpbGVOYW1lO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB0aHJvdyAnSW1hZ2VEZWNvZGVyRnJhbWV3b3JrLmpzOiBDb3VsZCBub3QgZ2V0IGN1cnJlbnQgc2NyaXB0IFVSTCc7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICByZXR1cm4gU2NyaXB0c1RvSW1wb3J0UG9vbDtcclxufSkoKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2NyaXB0c1RvSW1wb3J0UG9vbDsiLCIndXNlIHN0cmljdCc7XHJcblxyXG4vKiBnbG9iYWwgc2VsZjogZmFsc2UgKi9cclxuXHJcbnZhciBTdWJXb3JrZXJFbXVsYXRpb25Gb3JDaHJvbWUgPSAoZnVuY3Rpb24gU3ViV29ya2VyRW11bGF0aW9uRm9yQ2hyb21lQ2xvc3VyZSgpIHtcclxuICAgIHZhciBzdWJXb3JrZXJJZCA9IDA7XHJcbiAgICB2YXIgc3ViV29ya2VySWRUb1N1YldvcmtlciA9IG51bGw7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIFN1YldvcmtlckVtdWxhdGlvbkZvckNocm9tZShzY3JpcHRVcmwpIHtcclxuICAgICAgICBpZiAoc3ViV29ya2VySWRUb1N1YldvcmtlciA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aHJvdyAnQXN5bmNQcm94eSBpbnRlcm5hbCBlcnJvcjogU3ViV29ya2VyRW11bGF0aW9uRm9yQ2hyb21lICcgK1xyXG4gICAgICAgICAgICAgICAgJ25vdCBpbml0aWFsaXplZCc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICB0aGF0Ll9zdWJXb3JrZXJJZCA9ICsrc3ViV29ya2VySWQ7XHJcbiAgICAgICAgc3ViV29ya2VySWRUb1N1Yldvcmtlclt0aGF0Ll9zdWJXb3JrZXJJZF0gPSB0aGF0O1xyXG4gICAgICAgIFxyXG4gICAgICAgIHNlbGYucG9zdE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICB0eXBlOiAnc3ViV29ya2VyQ3RvcicsXHJcbiAgICAgICAgICAgIHN1YldvcmtlcklkOiB0aGF0Ll9zdWJXb3JrZXJJZCxcclxuICAgICAgICAgICAgc2NyaXB0VXJsOiBzY3JpcHRVcmxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgU3ViV29ya2VyRW11bGF0aW9uRm9yQ2hyb21lLmluaXRpYWxpemUgPSBmdW5jdGlvbiBpbml0aWFsaXplKFxyXG4gICAgICAgIHN1YldvcmtlcklkVG9TdWJXb3JrZXJfKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3ViV29ya2VySWRUb1N1YldvcmtlciA9IHN1YldvcmtlcklkVG9TdWJXb3JrZXJfO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgU3ViV29ya2VyRW11bGF0aW9uRm9yQ2hyb21lLnByb3RvdHlwZS5wb3N0TWVzc2FnZSA9IGZ1bmN0aW9uIHBvc3RNZXNzYWdlKFxyXG4gICAgICAgIGRhdGEsIHRyYW5zZmVyYWJsZXMpIHtcclxuICAgICAgICBcclxuICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHtcclxuICAgICAgICAgICAgdHlwZTogJ3N1YldvcmtlclBvc3RNZXNzYWdlJyxcclxuICAgICAgICAgICAgc3ViV29ya2VySWQ6IHRoaXMuX3N1YldvcmtlcklkLFxyXG4gICAgICAgICAgICBkYXRhOiBkYXRhXHJcbiAgICAgICAgfSxcclxuICAgICAgICB0cmFuc2ZlcmFibGVzKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIFN1YldvcmtlckVtdWxhdGlvbkZvckNocm9tZS5wcm90b3R5cGUudGVybWluYXRlID0gZnVuY3Rpb24gdGVybWluYXRlKFxyXG4gICAgICAgIGRhdGEsIHRyYW5zZmVyYWJsZXMpIHtcclxuICAgICAgICBcclxuICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHtcclxuICAgICAgICAgICAgdHlwZTogJ3N1YldvcmtlclRlcm1pbmF0ZScsXHJcbiAgICAgICAgICAgIHN1YldvcmtlcklkOiB0aGlzLl9zdWJXb3JrZXJJZFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdHJhbnNmZXJhYmxlcyk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICByZXR1cm4gU3ViV29ya2VyRW11bGF0aW9uRm9yQ2hyb21lO1xyXG59KSgpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTdWJXb3JrZXJFbXVsYXRpb25Gb3JDaHJvbWU7Il19
