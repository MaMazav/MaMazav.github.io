var PascalCellCalculator = (function PascalCellCalculatorClosure() {
    function PascalCellCalculator(dummyCtorArguments) {
    }
    
    PascalCellCalculator.prototype.start = function start(
            dependantTaskResults, taskKey) {
                
        console.log(
            'Performing very heavy calculation: sum of cell (' +
            taskKey.row + ', ' + taskKey.col + ')');
        
        var result = 0;
        for (var i = 0; i < dependantTaskResults.length; ++i) {
            result += dependantTaskResults[i];
        }
        return Promise.resolve(result);
    };
    
    return PascalCellCalculator;
})();