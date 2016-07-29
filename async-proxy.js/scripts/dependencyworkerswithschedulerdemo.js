var scriptsToImport = [AsyncProxy.AsyncProxyMaster.getEntryUrl() + '/scripts/pascalcellcalculator.js'];
var ctorNameOnWorkerSide = 'PascalCellCalculator';
var ctorArgsOnWorkerSide = ['dummyCtorArg'];
var workerInputRetreiver = createPascalCellInputRetreiver();

var scheduler = new ResourceScheduler.PriorityScheduler(
    function createDummyResource() {
        return {};
    },
    /*jobsLimit=*/2,
    /*prioritizer=*/{ getPriority: function(taskContext) {
        return taskContext.priority;
    }});

var schedulerDependencyWorkers = new AsyncProxy.SchedulerDependencyWorkers(
    scheduler, scriptsToImport, ctorNameOnWorkerSide, ctorArgsOnWorkerSide, workerInputRetreiver);

function demoDependencyWorkersWithScheduler() {
    startDemoDependencyWorkers('scheduler_', schedulerDependencyWorkers);
}