var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascalcellcalculator.js'];
var ctorNameOnWorkerSide = 'PascalCellCalculator';
var ctorArgsOnWorkerSide = ['dummyCtorArg'];
var workerInputRetreiver = createPascalCellInputRetreiver();

var pascalTriangleDependencyWorkers = new AsyncProxy.DependencyWorkers(
    scriptsToImport, ctorNameOnWorkerSide, ctorArgsOnWorkerSide, workerInputRetreiver);

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
            {row: row, col: 0});
        var contextLastInLine = dependencyWorkers.getTaskContext(
            {row: row, col: row});

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
        { row: row, col: col },
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
        
        getHashCode: function getHashCode(taskKey) {
            // Arbitrary scrambling
            return (taskKey.row << 16 + taskKey.row >> 16) ^ taskKey.col;
        },
        
        isEqual: function isEqual(taskKey1, taskKey2) {
            return taskKey1.row === taskKey2.row && taskKey1.col === taskKey2.col;
        }
    };
}

function PascalCellTaskContext(taskKey, callbacks) {
    this.callbacks = callbacks;
    this.priority = 0; // Default priority

    this._taskKey = taskKey;
    this._isProcessedAtLeastOnce = false;
    this._isWaitingForWorkerToStart = false;
    this._subTaskResults = [0, 0];
    
    if (taskKey.col > 0 && taskKey.col < taskKey.row) {
        callbacks.registerTaskDependency({ row: this._taskKey.row - 1, col: this._taskKey.col - 1 });
        callbacks.registerTaskDependency({ row: this._taskKey.row - 1, col: this._taskKey.col });
    }
}

PascalCellTaskContext.prototype.onDependencyTaskResult = function(value, key) {
    if (key.row !== this._taskKey.row - 1) {
        throw 'Unexpected row ' + key.row + '. Expected ' +
            (this._taskKey.row - 1);
    }
    switch (key.col) {
        case this._taskKey.col - 1: this._subTaskResults[0] = value; break;
        case this._taskKey.col    : this._subTaskResults[1] = value; break;
        default: throw 'Unexpected col ' + key.col + '. Expected ' +
            (this._taskKey.col - 1) + ' or ' + this._taskKey.col;
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
        console.log('Calculation of (' + this._taskKey.row + ', ' + this._taskKey.col + ') ended');
        this.callbacks.onTerminated();
    }

    if (!status.hasListeners) {
        // if no listeners the calculation can be stopped. It may happen if
        // taskHandle.unregister() is called.
        // In this demo taskHandle.unregister() is not called, so nothing to do there.
    }
};