'use strict';

asyncProxy.AsyncProxySlave.setBeforeOperationListener(
    function(operationType, name, args) {
        if (operationType === 'callback') {
            console.log(
                'before operation: type = ' + operationType +
                ', callback name = ' + name + // Defined only if passed by custom callback style
                ', args.length = ' + args.length);
        }
    }
);