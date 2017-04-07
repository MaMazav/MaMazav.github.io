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
        taskStarted: function(task) {
			var col = task.key.col;
			var row = task.key.row;
			if (col === 0 || col === row) {
				task.dataReady(1, WORKER_TYPE_NO_WORKER);
				task.terminate();
				return;
			}
			
			var alreadyTerminated = false;
			var isWaitingForWorkerToStart = false;
			
			task.MY_PRIORITY = 0;
			
			task.registerTaskDependency({row: row - 1, col: col - 1});
			task.registerTaskDependency({row: row - 1, col: col});
			
			task.dataReady(0); // Initial value
			
			task.on('dependencyTaskData', function(data, dependencyKey) {
				if (isWaitingForWorkerToStart) {
					return;
				}
					
				isWaitingForWorkerToStart = true;
				
				// Only add effect: Add a delay to see progressive calculation in demo
				setTimeout(function() {
					isWaitingForWorkerToStart = false;
					task.dataReady(task.dependTaskResults, WORKER_TYPE_SUM_ELEMENTS);
				}, 500);
			});
			
			task.on('statusUpdated', function(status) {
				task.MY_PRIORITY = status.priority;
				
				var shouldTerminate =
					!alreadyTerminated &&
					!isWaitingForWorkerToStart &&
					status.terminatedDependsTasks === status.dependsTasks; // Not waiting for dependency task
				
				if (shouldTerminate) {
					alreadyTerminated = true;
					console.log('Calculation of (' + row + ', ' + col + ') ended');
					task.terminate();
				}

				if (!status.hasListeners) {
					// if no listeners the calculation can be stopped. It may happen if
					// taskHandle.unregister() is called.
					// In this demo taskHandle.unregister() is not called, so nothing to do there.
				}
				if (status.isWaitingForWorkerResult) {
					// Can use isWaitingForWorkerResult indication to check if currently a worker
					// processes last data
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