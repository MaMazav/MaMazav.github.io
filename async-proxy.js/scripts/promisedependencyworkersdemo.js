var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascalcellcalculator.js'];
var ctorNameOnWorkerSide = 'PascalCellCalculator';
var ctorArgsOnWorkerSide = ['dummyCtorArg'];
var workerInputRetreiver = createPascalCellPromiseInputRetreiver();

var pascalTrianglePromiseDependencyWorkers = new AsyncProxy.PromiseDependencyWorkers(
    scriptsToImport, ctorNameOnWorkerSide, ctorArgsOnWorkerSide, workerInputRetreiver);

function demoPromiseDependencyWorkers() {
    for (var row = 0; row < 8; ++row) {
        for (var col = 0; col <= row; ++col) {
            var targetElement = document.getElementById('pascal_promise_' + row + '_' + col);
            targetElement.innerHTML = '?';
            calculatePascalTriangleCellUsingPromiseDependencyWorkers(targetElement, row, col);
        }
    }
}

function calculatePascalTriangleCellUsingPromiseDependencyWorkers(targetElement, row, col) {
    var taskPromise = pascalTrianglePromiseDependencyWorkers.startTaskPromise(
            { row: row, col: col });

    taskPromise.then(function(result) {
        targetElement.innerHTML = result;
    });
}

function createPascalCellPromiseInputRetreiver() {
    return {
        getDependsOnTasks: function (taskKey) {
            if (taskKey.col === 0 || taskKey.col === taskKey.row) {
                return [];
            } else {
                return [ { row: taskKey.row - 1, col: taskKey.col - 1 },
                         { row: taskKey.row - 1, col: taskKey.col     } ];
            }
        },
        preWorkerProcess: function (dependsTaskResults, dependsTaskKeys, taskKey) {
            // Do nothing; pass the depends task results array to the worker as-is
            if (taskKey.col === 0 || taskKey.col === taskKey.row) {
                dependsTaskResults = [1];
            }
            return Promise.resolve(dependsTaskResults);
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