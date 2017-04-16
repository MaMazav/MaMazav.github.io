'use strict';

var BeforeOperationListener = asyncProxy.AsyncProxyFactory.create(
	[asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/before-operation-listener-slave.js',
     asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'],
	'Callee',
	{ 'asyncFunctionWithCallback': [{}, 'callback'] }
);