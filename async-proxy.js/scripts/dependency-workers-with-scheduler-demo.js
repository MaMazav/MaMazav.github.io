var workerInputRetreiver = createPascalCellInputRetreiver();

var scheduler = new asyncProxy.DependencyWorkersTaskScheduler(/*jobsLimit=*/2);

var schedulerDependencyWorkers = new asyncProxy.SchedulerDependencyWorkers(
    scheduler, workerInputRetreiver);

function demoDependencyWorkersWithScheduler() {
    startDemoDependencyWorkers('scheduler_', schedulerDependencyWorkers);
}