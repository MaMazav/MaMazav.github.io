var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascalcellcalculator.js'];
var ctorNameOnWorkerSide = 'PascalCellCalculator';
var ctorArgsOnWorkerSide = ['dummyCtorArg'];
var workerInputRetreiver = createPascalCellInputRetreiver();

var pascalTriangleDependencyWorkers = new AsyncProxy.DependencyWorkers(
    scriptsToImport, ctorNameOnWorkerSide, ctorArgsOnWorkerSide, workerInputRetreiver);

function demoDependencyWorkers() {
    for (var row = 0; row < 8; ++row) {
        for (var col = 0; col <= row; ++col) {
            calculatePascalTriangleCell(row, col);
        }
    }
}

function calculatePascalTriangleCell(row, col) {
    pascalTriangleDependencyWorkers.startTask(
        { row: row, col: col },
        function onData(result) {
            document.getElementById('pascal_' + row + '_' + col).innerHTML = result;
        }
    );
}

function createPascalCellInputRetreiver() {
    return {
        createTaskContext: function (taskKey, onDataReadyToProcess, onTerminated) {
            return new PascalCellTaskContext(taskKey, onDataReadyToProcess, onTerminated);
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
    for (var i = 0; i < 3; ++i) {
        if (readyPrioritizedJobs.length === 0) {
            break;
        }
        var job = readyPrioritizedJobs.pop();
        job.onDataReadyToProcess(job.subTaskResults);
    }
}, 500);

function PascalCellTaskContext(taskKey, onDataReadyToProcess, onTerminated) {
    this.taskKey = taskKey;
    this.onDataReadyToProcess = onDataReadyToProcess;
    this.onTerminated = onTerminated;
    
    var dependsTasks = this.dependsOnTasks.length;
    if (dependsTasks === 0) {
        this.subTaskResults = [1];
        readyPrioritizedJobs.push(this);
    } else {
        this.subTaskResults = new Array(dependsTasks);
    }
}

Object.defineProperty(PascalCellTaskContext.prototype, 'dependsOnTasks', {
    get: function getDependsOnTasks() {
        if (this.taskKey.col === 0 || this.taskKey.col === this.taskKey.row) {
            return [];
        } else {
            return [ { row: this.taskKey.row - 1, col: this.taskKey.col - 1 },
                     { row: this.taskKey.row - 1, col: this.taskKey.col     } ];
        }
    }
});

PascalCellTaskContext.prototype.setPriority = function(priority) {
    // The priority is the maximum of all dependant tasks' priorities.
    // Use it if you have a resource limitation, as in this demo
    this.priority = priority;
    readyPrioritizedJobs.sort(function(a, b) {
        return a.priority - b.priority;
    });
};

PascalCellTaskContext.prototype.unregistered = function() {
    // Use this to stop unnecessary tasks and reduce resource usage
};

PascalCellTaskContext.prototype.onDependencyTaskResult = function(value, key) {
    if (key.row !== this.taskKey.row - 1) {
        throw 'Unexpected row ' + key.row + '. Expected ' +
            (this.taskKey.row - 1);
    }
    switch (key.col) {
        case this.taskKey.col - 1: this.subTaskResults[0] = value; break;
        case this.taskKey.col    : this.subTaskResults[1] = value; break;
        default: throw 'Unexpected col ' + key.col + '. Expected ' +
            (this.taskKey.col - 1) + ' or ' + this.taskKey.col;
    }
    if (this.subTaskResults[0] && this.subTaskResults[1]) {
        readyPrioritizedJobs.push(this);
    }
};