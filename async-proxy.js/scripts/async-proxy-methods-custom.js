'use strict';

var AsyncProxyMethodsCustom = asyncProxy.AsyncProxyFactory.create(
	[asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/methods-callee.js'],
	'Callee',
	{
		'asyncFunction': function asyncFunction() {
			var workerHelper = this._getWorkerHelper();
			var args = [];
			var promise = workerHelper.callFunction('asyncFunction', args, { isReturnPromise: true });
			return promise;
		},
		'asyncFunctionWithCallback': function asyncFunctionWithCallback(callback) {
			var workerHelper = this._getWorkerHelper();

			var wrappedCallback = this._workerHelper.wrapCallback(
				callback, 'someNameForUserEvents');
			
			var args = [wrappedCallback];
			workerHelper.callFunction('asyncFunctionWithCallback', args);
		},
		'passArrayBuffer': function passArrayBuffer(uint8Array) {
			var workerHelper = this._getWorkerHelper();

			var firstElement = uint8Array[0];
			console.log('First element of array - on UI: ' + firstElement);
			
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
		},
		'urgentFunction': function urgentFunction(callNumber) {
			var workerHelper = this._getWorkerHelper();
			var args = [callNumber];
			workerHelper.callFunction('urgentFunction', args, {isSendImmediately:true});
		}
	}
);