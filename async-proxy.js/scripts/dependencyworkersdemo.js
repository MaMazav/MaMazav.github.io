var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascalcellcalculator.js'];
var ctorNameOnWorkerSide = 'PascalCellCalculator';
var ctorArgsOnWorkerSide = ['dummyCtorArg'];
var workerInputRetreiver = createPascalCellInputRetreiver();

var pascalTriangleDependencyWorkers = new AsyncProxy.DependencyWorkers(
    scriptsToImport, ctorNameOnWorkerSide, ctorArgsOnWorkerSide, workerInputRetreiver);

function demoDependencyWorkers() {
    for (var row = 0; row < 8; ++row) {
        for (var col = 0; col <= row; ++col) {
            calculatePascalTriangleCell(row, col);
        }
    }
}

function calculatePascalTriangleCell(row, col) {
    pascalTriangleDependencyWorkers
        .startTask({ row: row, col: col })
        .then(function(result) {
            document.getElementById('pascal_' + row + '_' + col).innerHTML = result;
        });
}

function createPascalCellInputRetreiver() {
    return {
        getWorkerInput: function getWorkerInput(taskKey) {
            if (taskKey.col === 0 || taskKey.col === taskKey.row) {
                return { resultPromise: Promise.resolve(1) };
            } else {
                return { dependantTasks: [
                    { row: taskKey.row - 1, col: taskKey.col - 1 },
                    { row: taskKey.row - 1, col: taskKey.col }
                ]};
            }
        },
        
        getHashCode: function getHashCode(taskKey) {
            // Arbitrary scrambling
            return (taskKey.row << 16 + taskKey.row >> 16) ^ taskKey.col;
        },
        
        isEqual: function isEqual(taskKey1, taskKey2) {
            return taskKey1.row === taskKey2.row && taskKey1.col === taskKey2.col;
        }
    };
}