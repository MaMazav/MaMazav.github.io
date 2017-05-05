var workerInputRetreiver = createPascalCellInputRetreiver();

var scheduler = new dependencyWorkers.DependencyWorkersTaskScheduler(/*jobsLimit=*/2);

var schedulerDependencyWorkers = new dependencyWorkers.SchedulerDependencyWorkers(
    scheduler, workerInputRetreiver);

function demoDependencyWorkersWithScheduler() {
    startDemoDependencyWorkers('scheduler_', schedulerDependencyWorkers);
}