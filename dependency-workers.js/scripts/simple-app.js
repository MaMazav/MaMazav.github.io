var workerInputRetreiver = createPascalCellSimpleInputRetreiver();
var pascalTriangleSimpleDependencyWorkers = new dependencyWorkers.DependencyWorkers(workerInputRetreiver);

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
    var taskPromise = pascalTriangleSimpleDependencyWorkers.startTaskPromise(
        {row: row, col: col});

    taskPromise.then(function(result) {
        targetElement.innerHTML = result;
    });
}