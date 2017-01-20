'use strict';

var UserDataMaster = AsyncProxy.AsyncProxyFactory.create(
	[AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/user-data-slave.js',
     AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'],
	'Callee',
	{ 'helloWorld': [] }
);

/*
var UserDataMaster = (function UserDataMasterClosure() {
    function UserDataMaster(ctorArgument) {
        var args = [ctorArgument];
        var scriptsToImport = [
            AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js',
            AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/user-data-slave.js'];
        this._workerHelper = new AsyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee', args);
        
        this._workerHelper.setUserDataHandler(function(data) {
            alert('Data arrived: ' + data);
        });
    }
    
    UserDataMaster.prototype.helloWorld = function helloWorld(functionArg) {
        var args = [functionArg];
        this._workerHelper.callFunction('helloWorld', args);
    };
    
    return UserDataMaster;
})();
*/