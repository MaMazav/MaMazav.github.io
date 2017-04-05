var PascalCellCalculator = (function PascalCellCalculatorClosure() {
    function PascalCellCalculator(dummyCtorArguments) {
    }
    
    PascalCellCalculator.prototype.start = function start(
            dependantTaskResults, taskKey) {
                
        var result = 0;
        for (var i = 0; i < dependantTaskResults.length; ++i) {
            result += dependantTaskResults[i];
        }
        console.log(
            'Performing very heavy calculation: Cell (' + taskKey.row + ',' +
                taskKey.col + '), result ' + result);
        
        return Promise.resolve(result);
    };
    
    return PascalCellCalculator;
})();