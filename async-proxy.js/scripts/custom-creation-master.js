'use strict';

var CustomCreationProxy = asyncProxy.AsyncProxyFactory.create(
	[asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/custom-creation-slave.js'],
	'ClassNameDoesntMatter',
	{ 'someFunction': [{isReturnPromise: true}] }
);