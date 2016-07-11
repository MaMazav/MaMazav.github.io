'use strict';

var CustomCreationProxy = (function CustomCreationProxyClosure() {
    function CustomCreationProxy(ctorArgument) {
        var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/customcreationslave.js'];
        
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(
            scriptsToImport,
            'ClassNameDoesntMatter',
            [ctorArgument]);
    }
    
    CustomCreationProxy.prototype.someFunction = function someFunction(functionArgument) {
        var args = [functionArgument];
        return this._workerHelper.callFunction('someFunction', args, { isReturnPromise: true });
    };
    
    return CustomCreationProxy;
})();