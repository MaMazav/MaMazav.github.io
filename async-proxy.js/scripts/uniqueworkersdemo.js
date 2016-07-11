var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/uniqueworker.js'];
var ctorNameOnWorkerSide = 'PascalCellCalculator';
var ctorArgsOnWorkerSide = ['dummyCtorArg'];
var workerInputRetreiver = createPascalCellInputRetreiver();

var pascalTriangleUniqueWorkers = new AsyncProxy.UniqueWorkers(
    scriptsToImport, ctorNameOnWorkerSide, ctorArgsOnWorkerSide, workerInputRetreiver);

function demoUniqueWorkers() {
    for (var row = 0; row < 8; ++row) {
        for (var col = 0; col <= row; ++col) {
            calculatePascalTriangleCell(row, col);
        }
    }
}

function calculatePascalTriangleCell(row, col) {
    pascalTriangleUniqueWorkers
        .startTask({ row: row, col: col })
        .then(function(result) {
            document.getElementById('pascal_' + row + '_' + col).innerHTML = result;
        });
}

function createPascalCellInputRetreiver() {
    return {
        getWorkerInput: function getWorkerInput(taskKey) {
            var waitingSubTasks = [];
            var subTasksResults = [];
            
            var minCol = taskKey.col > 0 ? taskKey.col - 1 : taskKey.col;
            var maxCol = taskKey.col < taskKey.row ? taskKey.col : taskKey.col - 1;
            for (var col = minCol; col <= maxCol; ++col) {
                var subTask = pascalTriangleUniqueWorkers.startTask({
                    row: taskKey.row - 1,
                    col: col
                }).then(function(prevRowResult) {
                    subTasksResults.push(prevRowResult);
                });
                
                waitingSubTasks.push(subTask);
            }
            
            if (taskKey.row === 0) {
                subTasksResults.push(1);
            }
            
            return Promise.all(waitingSubTasks).then(function() {
                var taskInput = {
                    pascalParentElement1: subTasksResults[0] || 0,
                    pascalParentElement2: subTasksResults[1] || 0
                };
                return taskInput;
            });
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