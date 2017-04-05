var workerInputRetreiver = createPascalCellInputRetreiver();
var pascalTriangleDependencyWorkers = new AsyncProxy.DependencyWorkers(workerInputRetreiver);

function demoDependencyWorkers() {
    startDemoDependencyWorkers('', pascalTriangleDependencyWorkers);
}

function startDemoDependencyWorkers(htmlElementPrefix, dependencyWorkers) {
    for (var row = 0; row < 8; ++row) {
        for (var col = 0; col <= row; ++col) {
            var targetElement = document.getElementById(htmlElementPrefix + 'pascal_' + row + '_' + col);
            targetElement.innerHTML = '?';
            calculatePascalTriangleCell(dependencyWorkers, targetElement, row, col);
        }
    }
}

function calculatePascalTriangleCell(dependencyWorkers, targetElement, row, col) {
    var taskHandle = dependencyWorkers.startTask(
        {row: row, col: col},
        { onData: function(result) {
              targetElement.innerHTML = result;
          }, onTerminated: function() {
              targetElement.innerHTML = targetElement.innerHTML + '!';
          }
        }
    );
    taskHandle.setPriority(col / (row + 1));
}

function createPascalCellInputRetreiver() {
    return {
        taskStarted: function(taskKey, task) {
			if (taskKey.col === 0 || taskKey.col === taskKey.row) {
				task.dataReady(1, WORKER_TYPE_NO_WORKER);
				task.terminate();
				return;
			}
			
			var isProcessedAtLeastOnce = false;
			var isWaitingForWorkerToStart = false;
			var subTaskResults = [0, 0];
			
			task.MY_PRIORITY = 0;
			
			task.registerTaskDependency({row: taskKey.row - 1, col: taskKey.col - 1});
			task.registerTaskDependency({row: taskKey.row - 1, col: taskKey.col});
			
			task.on('dependencyTaskData', function(data, dependencyKey) {
				switch (dependencyKey.col) {
					case taskKey.col - 1: subTaskResults[0] = data; break;
					case taskKey.col    : subTaskResults[1] = data; break;
					default: throw 'Unexpected col ' + dependencyKey.col + '. Expected ' +
						(taskKey.col - 1) + ' or ' + taskKey.col;
				}
				if (isWaitingForWorkerToStart) {
					return;
				}
					
				isWaitingForWorkerToStart = true;
				isProcessedAtLeastOnce = true;
				
				// Only add effect: Add a delay to see progressive calculation in demo
				setTimeout(function() {
					isWaitingForWorkerToStart = false;
					task.dataReady(subTaskResults, WORKER_TYPE_SUM_ELEMENTS);
				}, 500);
			});
			
			task.on('statusUpdated', function(status) {
				task.MY_PRIORITY = status.priority;
				
				var isTaskFinished =
					!status.isWaitingForWorkerResult &&
					!isWaitingForWorkerToStart &&
					status.terminatedDependsTasks === status.dependsTasks && // Not waiting for dependency task
					isProcessedAtLeastOnce; // Avoid immediate termination in tasks with no dependencies
				
				if (isTaskFinished) {
					console.log('Calculation of (' + taskKey.row + ', ' + taskKey.col + ') ended');
					task.terminate();
				}

				if (!status.hasListeners) {
					// if no listeners the calculation can be stopped. It may happen if
					// taskHandle.unregister() is called.
					// In this demo taskHandle.unregister() is not called, so nothing to do there.
				}
			});
        },
        getWorkerTypeOptions: function(taskType) {
			if (taskType === WORKER_TYPE_NO_WORKER) {
				return null;
			}
			
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