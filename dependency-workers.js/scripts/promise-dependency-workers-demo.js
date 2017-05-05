var workerInputRetreiver = createPascalCellPromiseInputRetreiver();

var pascalTrianglePromiseDependencyWorkers = new dependencyWorkers.DependencyWorkers(workerInputRetreiver);

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

var WORKER_TYPE_NO_WORKER = 0;
var WORKER_TYPE_SUM_ELEMENTS = 1;

function createPascalCellPromiseInputRetreiver() {
    return {
		taskStarted: function(task) {
            if (task.key.col === 0 || task.key.col === task.key.row) {
				task.dataReady(1, WORKER_TYPE_NO_WORKER);
				task.terminate();
				return;
			}

			task.registerTaskDependency({row: task.key.row - 1, col: task.key.col - 1});
			task.registerTaskDependency({row: task.key.row - 1, col: task.key.col});
			task.on('allDependTasksTerminated', function() {
				task.dataReady(task.dependTaskResults, WORKER_TYPE_SUM_ELEMENTS);
				task.terminate();
			});
		},
		
        getWorkerTypeOptions: function(taskType) {
			if (taskType === WORKER_TYPE_NO_WORKER) {
				return null;
			}
			
            return {
                scriptsToImport: [asyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascal-cell-calculator.js'],
                ctorName: 'PascalCellCalculator',
                ctorArgs: ['dummyCtorArg']
            }
        },
        
        getKeyAsString: function(taskKey) {
            return taskKey.row + ':' + taskKey.col;
        }
    };
}