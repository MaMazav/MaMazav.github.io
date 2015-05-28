'use strict';

AsyncProxy.AsyncProxySlave.setBeforeOperationListener(
    function(operationType, name, args) {
        if (operationType === 'callback') {
            console.log(
                'before operation: type = ' + operationType +
                ', callback name = ' + name +
                ', args.length = ' + args.length);
        }
    }
);