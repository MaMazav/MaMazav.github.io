'use strict';

var scriptsToImport = [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'];
var ctorName = 'Callee';

var AsyncProxyHelloWorldCustom = asyncProxy.AsyncProxyFactory.create(
    scriptsToImport, ctorName);

AsyncProxyHelloWorldCustom.prototype.helloWorld = function helloWorld(functionArg) {
    var workerHelper = asyncProxy.AsyncProxyFactory.getWorkerHelper(this);
    var args = [functionArg];
    workerHelper.callFunction('helloWorld', args);
};