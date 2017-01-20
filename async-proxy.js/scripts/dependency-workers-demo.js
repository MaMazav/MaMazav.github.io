var TASK_TYPE = 17; // Arbitrary number ; It has no meaning in this demo, only single type is used

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
    
    // Demonstrates how to use getTaskContext() to provide data from external
    // source (only for already-spawned tasks)
    for (var row = 0; row < 8; ++row) {
        var contextFirstInLine = dependencyWorkers.getTaskContext(
            keyFromRowCol(row, 0));
        var contextLastInLine = dependencyWorkers.getTaskContext(
            keyFromRowCol(row, row));

        if (contextFirstInLine === null || contextLastInLine === null) {
            throw 'Error: task has not been spawned yet';
        }
        
        // No need for worker for edge cells; Result always 1
        contextFirstInLine.callbacks.onDataReadyToProcess(1, /*isDisableWorker=*/true);
        contextFirstInLine.callbacks.onTerminated();
        if (row > 0) {
            contextLastInLine.callbacks.onDataReadyToProcess(1, /*isDisableWorker=*/true);
            contextLastInLine.callbacks.onTerminated();
        }
    }
}

function calculatePascalTriangleCell(dependencyWorkers, targetElement, row, col) {
    var taskHandle = dependencyWorkers.startTask(
        keyFromRowCol(row, col),
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
        createTaskContext: function (taskKey, callbacks) {
            return new PascalCellTaskContext(taskKey, callbacks);
        },
        getWorkerTypeByTaskKey: function getWorkerTypeByTaskKey(taskKey) {
            return 0;
        },
        getTaskOptions: function getTaskOptions(taskType) {
            // In this demo: taskType always equals TASK_TYPE
            return {
                scriptsToImport: [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascal-cell-calculator.js'],
                ctorName: 'PascalCellCalculator',
                ctorArgs: ['dummyCtorArg']
            }
        }
    };
}

function PascalCellTaskContext(taskKey, callbacks) {
    this.callbacks = callbacks;
    this.priority = 0; // Default priority

    this._isProcessedAtLeastOnce = false;
    this._isWaitingForWorkerToStart = false;
    this._subTaskResults = [0, 0];
    
    var colonPos = taskKey.indexOf(':');
    this._row = rowFromKey(taskKey);
    this._col = colFromKey(taskKey);
    
    if (this._col > 0 && this._col < this._row) {
        callbacks.registerTaskDependency(keyFromRowCol(this._row - 1, this._col - 1));
        callbacks.registerTaskDependency(keyFromRowCol(this._row - 1, this._col));
    }
}

PascalCellTaskContext.prototype.onDependencyTaskResult = function(value, key) {
    var col = colFromKey(key);
    switch (col) {
        case this._col - 1: this._subTaskResults[0] = value; break;
        case this._col    : this._subTaskResults[1] = value; break;
        default: throw 'Unexpected col ' + col + '. Expected ' +
            (this._col - 1) + ' or ' + this._col;
    }
    
    if (this._isWaitingForWorkerToStart) {
        return;
    }
    
    this._isWaitingForWorkerToStart = true;
    this._isProcessedAtLeastOnce = true;
    var that = this;
    
    // Only add effect: Add a delay to see progressive calculation in demo
    setTimeout(function() {
        that._isWaitingForWorkerToStart = false;
        that.callbacks.onDataReadyToProcess(that._subTaskResults);
    }, 500);
};

PascalCellTaskContext.prototype.statusUpdated = function(status) {
    if (status.priority !== this.priority) {
        this.priority = status.priority;
    }
    
    var isTaskFinished =
        !status.isWaitingForWorkerResult &&
        !this._isWaitingForWorkerToStart &&
        status.terminatedDependsTasks === status.dependsTasks && // Not waiting for dependency task
        this._isProcessedAtLeastOnce; // Avoid immediate termination in tasks with no dependencies
    
    if (isTaskFinished) {
        console.log('Calculation of (' + this._row + ', ' + this._col + ') ended');
        this.callbacks.onTerminated();
    }

    if (!status.hasListeners) {
        // if no listeners the calculation can be stopped. It may happen if
        // taskHandle.unregister() is called.
        // In this demo taskHandle.unregister() is not called, so nothing to do there.
    }
};

PascalCellTaskContext.prototype.getTaskType = function() {
    return TASK_TYPE;
};