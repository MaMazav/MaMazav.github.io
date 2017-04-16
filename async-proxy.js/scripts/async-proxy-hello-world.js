'use strict';

var scriptsToImport = [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
var ctorName = 'Callee';
var AsyncProxyHelloWorld = asyncProxy.AsyncProxyFactory.create(
	scriptsToImport,
	ctorName,
	{ 'helloWorld': [] }
);