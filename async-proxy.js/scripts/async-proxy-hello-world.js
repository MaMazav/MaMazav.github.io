'use strict';

var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
var ctorName = 'Callee';
var AsyncProxyHelloWorld = AsyncProxy.AsyncProxyFactory.create(
	scriptsToImport,
	ctorName,
	{ 'helloWorld': [] }
);