var PascalCellCalculator = (function PascalCellCalculatorClosure() {
    function PascalCellCalculator(dummyCtorArguments) {
        
    }
    
    PascalCellCalculator.prototype.start = function start(
            dependantTaskResults, dependantTaskKeys) {
                
        console.log(
            'Performing very heavy calculation: sum of cells (' +
            dependantTaskKeys[0].row + ', ' + dependantTaskKeys[0].col + ') and (' +
            dependantTaskKeys[1].row + ', ' + dependantTaskKeys[1].col + ')');
        
        return Promise.resolve(dependantTaskResults[0] + dependantTaskResults[1]);
    };
    
    return PascalCellCalculator;
})();