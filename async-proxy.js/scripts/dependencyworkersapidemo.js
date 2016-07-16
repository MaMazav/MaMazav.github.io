function demoDependencyWorkers(dependencyWorkers) {
    for (var row = 0; row < 8; ++row) {
        for (var col = 0; col <= row; ++col) {
            var targetElement = document.getElementById('pascal_' + row + '_' + col);
            targetElement.innerHTML = '?';
            calculatePascalTriangleCell(dependencyWorkers, targetElement, row, col);
        }
    }
}

function calculatePascalTriangleCell(dependencyWorkers, targetElement, row, col) {
    var taskHandle = pascalTriangleDependencyWorkers.startTask(
        { row: row, col: col },
        function onData(result) {
            targetElement.innerHTML = result;
        }
    );
    taskHandle.setPriority(col);
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

