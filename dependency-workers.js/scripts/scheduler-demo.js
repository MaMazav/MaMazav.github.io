var progressiveInputRetreiver = createPascalCellProgressiveInputRetreiver();
var scheduler = new dependencyWorkers.DependencyWorkersTaskScheduler(/*jobsLimit=*/2);

var schedulerDependencyWorkers = new dependencyWorkers.SchedulerDependencyWorkers(
    scheduler, progressiveInputRetreiver);

function demoDependencyWorkersWithScheduler() {
    startDemoDependencyWorkers('scheduler_', schedulerDependencyWorkers);
}