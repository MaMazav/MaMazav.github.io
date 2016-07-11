var PascalCellCalculator = (function PascalCellCalculatorClosure() {
    function PascalCellCalculator(dummyCtorArguments) {
        
    }
    
    PascalCellCalculator.prototype.start = function start(inputArgs, taskKey) {
        console.log('Performing very heavy calculation of task (' + taskKey.row + ', ' + taskKey.col + ')');
        return new Promise(function(resolve, reject) {
            resolve(inputArgs.pascalParentElement1 + inputArgs.pascalParentElement2);
        });
    };
    
    return PascalCellCalculator;
})();