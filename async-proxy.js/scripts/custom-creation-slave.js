'use strict';

asyncProxy.AsyncProxySlave.setSlaveSideCreator(function(ctorArgument) {
    var instance = {
        someFunction: function(functionArgument) {
            return someLogic(ctorArgument, functionArgument);
        }
    };
    
    return instance;
});

function someLogic(arg1, arg2) {
    return new Promise(function(resolve, reject) {
        var functionResult = arg1 + arg2;
        resolve(functionResult);
    });
}