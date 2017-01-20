'use strict';

var BeforeOperationListener = AsyncProxy.AsyncProxyFactory.create(
	[AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/before-operation-listener-slave.js',
     AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'],
	'Callee',
	{ 'asyncFunctionWithCallback': [{}, 'callback'] }
);