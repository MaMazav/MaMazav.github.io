'use strict';

var UserDataMasterBase = asyncProxy.AsyncProxyFactory.create(
    [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/user-data-slave.js',
     asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js'],
    'Callee',
    { 'helloWorld': [] }
);

function UserDataMaster() {
    UserDataMasterBase.call(this);
    asyncProxy.AsyncProxyFactory.getWorkerHelper(this).setUserDataHandler(function(data) {
        alert('Data arrived: ' + data);
    });
}

UserDataMaster.prototype = Object.create(UserDataMasterBase.prototype);

/*
var UserDataMaster = (function UserDataMasterClosure() {
    function UserDataMaster(ctorArgument) {
        var args = [ctorArgument];
        var scriptsToImport = [
            asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js',
            asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/user-data-slave.js'];
        this._workerHelper = new asyncProxy.AsyncProxyMaster(scriptsToImport, 'Callee', args);
        
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