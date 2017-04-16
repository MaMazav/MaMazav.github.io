'use strict';

var scriptsToImport = [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
var ctorName = 'Callee';
var AsyncProxyHelloWorldCustom = asyncProxy.AsyncProxyFactory.create(
	scriptsToImport,
	ctorName,
	{ 'helloWorld': function helloWorld(functionArg) {
		var workerHelper = this._getWorkerHelper();
        var args = [functionArg];
        workerHelper.callFunction('helloWorld', args);
	} }
);