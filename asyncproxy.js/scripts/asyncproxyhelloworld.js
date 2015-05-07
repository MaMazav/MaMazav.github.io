'use strict';

var AsyncProxyHelloWorld = (function AsyncProxyHelloWorldClosure() {
    function AsyncProxyHelloWorld(ctorArgument) {
        var args = [ctorArgument];
        var scriptsToImport = AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/callee.js';
        this._workerHelper = new AsyncProxy.AsyncProxyMaster([scriptsToImport], 'Callee', args);
    }
    
    AsyncProxyHelloWorld.prototype.helloWorld = function helloWorld(functionArg) {
        var args = [functionArg];
        this._workerHelper.callFunction('helloWorld', args);
    };
    
    return AsyncProxyHelloWorld;
})();