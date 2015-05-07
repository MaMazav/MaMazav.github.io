'use strict';

function demoUrgentFunctions() {
    var proxy = new UrgentFunctionsProxy();
    
    var callNumber = 0;
    
    for (var i = 0; i < 5; ++i) {
        for (var j = 0; j < 20; ++j) {
            console.log('Calling non urgent function. callNumber=' + (++callNumber));
            proxy.nonUrgentFunction(callNumber);
        }
        
        console.log('Calling urgent function. callNumber=' + (++callNumber));
        proxy.urgentFunction(callNumber);
    }
}