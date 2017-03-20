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
        {row: row, col: col});

    taskPromise.then(function(result) {
        targetElement.innerHTML = result;
    });
}

function createPascalCellPromiseInputRetreiver() {
    return {
        getPromiseTaskProperties: function(taskKey) {
            var dependsOnTasks = [];
            if (taskKey.col > 0 && taskKey.col < taskKey.row) {
                dependsOnTasks = [ {row: taskKey.row - 1, col: taskKey.col - 1},
                                   {row: taskKey.row - 1, col: taskKey.col} ];
            }
            
            return {
                taskType: 0,
                dependsOnTasks: dependsOnTasks,
                isDisableWorker: false
            };
        },
        
        preWorkerProcess: function(dependsTaskResults, dependsTaskKeys, taskKey) {
            // Do nothing; pass the depends task results array to the worker as-is
            if (taskKey.col > 0 && taskKey.col < taskKey.row) {
                return Promise.resolve(dependsTaskResults);
            } else {
                return Promise.resolve([1]);
            }
        },
        
        getTaskTypeOptions: function(taskType) {
            return {
                scriptsToImport: [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascal-cell-calculator.js'],
                ctorName: 'PascalCellCalculator',
                ctorArgs: ['dummyCtorArg']
            }
        },
        
        getKeyAsString: function(taskKey) {
            return taskKey.row + ':' + taskKey.col;
        }
    };
}