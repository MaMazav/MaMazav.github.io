'use strict';

var ProxyWithImportDirective = (function AsyncProxyHelloWorldClosure() {
    function ProxyWithImportDirective(ctorArgument) {
        var args = [ctorArgument];
        var scriptsToImport = predefinedScriptsToImport.getScriptsForWorkerImport();
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'CalleeWithImportDirective', args);
    }
    
    ProxyWithImportDirective.prototype.helloWorld = function helloWorld(functionArg) {
        var args = [functionArg];
        this._workerHelper.callFunction('helloWorld', args);
    };
    
    return ProxyWithImportDirective;
})();