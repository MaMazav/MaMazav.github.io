'use strict';

var CustomCreationProxy = AsyncProxy.AsyncProxyFactory.create(
	[AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/custom-creation-slave.js'],
	'ClassNameDoesntMatter',
	{ 'someFunction': [{isReturnPromise: true}] }
);