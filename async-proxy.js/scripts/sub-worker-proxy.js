'use strict';

var SubWorkerProxy = AsyncProxy.AsyncProxyFactory.create(
	[AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js',
	 AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/sub-worker-proxy.js'],
	'Callee',
	{ 'callSubWorker': [] }
);