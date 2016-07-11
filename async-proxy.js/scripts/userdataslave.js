'use strict';

setTimeout(function() {
        AsyncProxy.AsyncProxySlave.sendUserDataToMaster('1st chunk of data');
    }, 1000);

setTimeout(function() {
        AsyncProxy.AsyncProxySlave.sendUserDataToMaster('2nd chunk of data');
    }, 2000);

setTimeout(function() {
        AsyncProxy.AsyncProxySlave.sendUserDataToMaster('3rd chunk of data');
    }, 3000);