var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascalcellcalculator.js'];
var ctorNameOnWorkerSide = 'PascalCellCalculator';
var ctorArgsOnWorkerSide = ['dummyCtorArg'];
var workerInputRetreiver = createPascalCellInputRetreiver();

var pascalTriangleDependencyWorkers = new AsyncProxy.DependencyWorkers(
    scriptsToImport, ctorNameOnWorkerSide, ctorArgsOnWorkerSide, workerInputRetreiver);

function demoDependencyWorkers() {
    for (var row = 0; row < 8; ++row) {
        for (var col = 0; col <= row; ++col) {
            var targetElement = document.getElementById('pascal_' + row + '_' + col);
            targetElement.innerHTML = '?';
            calculatePascalTriangleCell(targetElement, row, col);
        }
    }
    
    // Demonstrates how to use getTaskContext() to provide data from external
    // source (only for already-spawned tasks)
    for (var row = 0; row < 8; ++row) {
        var contextFirstInLine = pascalTriangleDependencyWorkers.getTaskContext(
            {row: row, col: 0});
        var contextLastInLine = pascalTriangleDependencyWorkers.getTaskContext(
            {row: row, col: row});

        if (contextFirstInLine === null || contextLastInLine === null) {
            throw 'Error: task has not been spawned yet';
        }
        
        // dummy. Just need to pass to the worker an array with sum of 1
        contextFirstInLine.subTaskResults = [1]; 
        contextLastInLine.subTaskResults = [1];
        
        contextFirstInLine.scheduleTask();
        contextLastInLine.scheduleTask();
    }
}

function calculatePascalTriangleCell(targetElement, row, col) {
    var taskHandle = pascalTriangleDependencyWorkers.startTask(
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

var readyPrioritizedJobs = [];
setInterval(function emulateResourceLimitation() {
    if (readyPrioritizedJobs.length === 0) {
        return;
    }
    var job = readyPrioritizedJobs.pop();
    job.isWaitingForResource = false;
    
    // Some heavy calculation can go here, and then...
    var processingEndedPromise = job.callbacks.onDataReadyToProcess(job.subTaskResults);
}, 50);

function PascalCellTaskContext(taskKey, callbacks) {
    this.callbacks = callbacks;
    this.isWaitingForResource = false;
    this.isProcessedAtLeastOnce = false;
    this.priority = 0; // Default priority

    this._taskKey = taskKey;
    
    this.subTaskResults = [0, 0];
}

Object.defineProperty(PascalCellTaskContext.prototype, 'dependsOnTasks', {
    get: function getDependsOnTasks() {
        if (this._taskKey.col === 0 || this._taskKey.col === this._taskKey.row) {
            return [];
        } else {
            return [ { row: this._taskKey.row - 1, col: this._taskKey.col - 1 },
                     { row: this._taskKey.row - 1, col: this._taskKey.col     } ];
        }
    }
});

PascalCellTaskContext.prototype.onDependencyTaskResult = function(value, key) {
    if (key.row !== this._taskKey.row - 1) {
        throw 'Unexpected row ' + key.row + '. Expected ' +
            (this._taskKey.row - 1);
    }
    switch (key.col) {
        case this._taskKey.col - 1: this.subTaskResults[0] = value; break;
        case this._taskKey.col    : this.subTaskResults[1] = value; break;
        default: throw 'Unexpected col ' + key.col + '. Expected ' +
            (this._taskKey.col - 1) + ' or ' + this._taskKey.col;
    }
    
    this.scheduleTask();
};

PascalCellTaskContext.prototype.scheduleTask = function() {
    if (!this.isWaitingForResource) {
        this.isWaitingForResource = true;
        this.isProcessedAtLeastOnce = true;
        readyPrioritizedJobs.push(this);
    }
};

PascalCellTaskContext.prototype.statusUpdated = function(status) {
    if (status.priority !== this.priority) {
        this.priority = status.priority;
        readyPrioritizedJobs.sort(function(a, b) {
            return a.priority - b.priority;
        });
    }
    
    var isWorkerFinished =
        status.isIdle && // Not waiting for active worker in DependencyWorkers
        !this.isWaitingForResource && // Not waiting for resource
        status.terminatedDependsTasks === this.dependsOnTasks.length && // Not waiting for dependency task
        this.isProcessedAtLeastOnce; // Avoid immediate termination in tasks with no dependencies
    
    if (isWorkerFinished) {
        console.log('Calculation of (' + this._taskKey.row + ', ' + this._taskKey.col + ') ended');
        this.callbacks.onTerminated();
    }

    if (!status.hasListeners) {
        // if no listeners the calculation can be stopped. It may happen if
        // taskHandle.unregister() is called.
        // In this demo taskHandle.unregister() is not called, so nothing to do there.
    }
};