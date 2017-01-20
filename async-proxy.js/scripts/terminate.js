'use strict';

var TerminateProxy = AsyncProxy.AsyncProxyFactory.create(
	[AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js',
	 AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/sub-worker-proxy.js'],
	'Callee',
	{
		'callSubWorker': [],
		'releaseResources': function() {
			var workerHelper = this._getWorkerHelper();
			var args = [];
			var promise = workerHelper.callFunction('releaseResources', args, { isReturnPromise: true });
			
			return promise.then(function() {
				workerHelper.terminate();
			});
		}
	}
);