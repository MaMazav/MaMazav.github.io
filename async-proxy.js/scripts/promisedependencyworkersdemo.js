var workerInputRetreiver = createPascalCellPromiseInputRetreiver();

var pascalTrianglePromiseDependencyWorkers = new AsyncProxy.PromiseDependencyWorkers(workerInputRetreiver);

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
            keyFromRowCol(row, col));

    taskPromise.then(function(result) {
        targetElement.innerHTML = result;
    });
}

function createPascalCellPromiseInputRetreiver() {
    return {
        getDependsOnTasks: function (taskKey) {
            var row = rowFromKey(taskKey);
            var col = colFromKey(taskKey);
            if (col === 0 || col === row) {
                return [];
            } else {
                return [ keyFromRowCol(row - 1, col - 1),
                         keyFromRowCol(row - 1, col) ];
            }
        },
        
        preWorkerProcess: function (dependsTaskResults, dependsTaskKeys, taskKey) {
            var row = rowFromKey(taskKey);
            var col = colFromKey(taskKey);
            // Do nothing; pass the depends task results array to the worker as-is
            if (col > 0 && col < row) {
                return Promise.resolve(dependsTaskResults);
            } else {
                return Promise.resolve([1]);
            }
        },
        
        getWorkerTypeByTaskKey: function getWorkerTypeByTaskKey(taskKey) {
            return 0;
        },
        
        getTaskOptions: function getTaskOptions(workerType) {
            return {
                scriptsToImport: [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascalcellcalculator.js'],
                ctorName: 'PascalCellCalculator',
                ctorArgs: ['dummyCtorArg']
            }
        }
    };
}

function keyFromRowCol(row, col) {
    return row + ':' + col;
}

function rowFromKey(taskKey) {
    return Number(taskKey.substr(0, taskKey.indexOf(':')));
}

function colFromKey(taskKey) {
    return Number(taskKey.substr(taskKey.indexOf(':') + 1));
}