'use strict';

var SubWorkerProxy = asyncProxy.AsyncProxyFactory.create(
    [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/callee.js',
     asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/sub-worker-proxy.js'],
    'Callee',
    { 'callSubWorker': [] }
);