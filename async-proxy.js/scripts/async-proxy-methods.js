'use strict';

var AsyncProxyMethods = asyncProxy.AsyncProxyFactory.create(
	[asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'],
	'Callee',
	{
		'asyncFunction': [{isReturnPromise: true}],
		'asyncFunctionWithCallback': [{}, 'callback'],
		'passArrayBuffer': [ {
			isReturnPromise: true,
			transferables: [[0, 'buffer']], // To send transferable as argument
			pathsToTransferablesInPromiseResult: [['someProperty', 'buffer']] // To receive transferable in promise result
		} ],
		'urgentFunction': [{isSendImmediately:true}]
	}
);