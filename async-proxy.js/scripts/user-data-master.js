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