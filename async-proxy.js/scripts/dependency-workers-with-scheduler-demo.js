var workerInputRetreiver = createPascalCellInputRetreiver();

var scheduler = new ResourceScheduler.PriorityScheduler(
    function createDummyResource() {
        return {};
    },
    /*jobsLimit=*/2,
    /*prioritizer=*/{ getPriority: function(task) {
        return task.MY_PRIORITY;
    }});

var schedulerDependencyWorkers = new AsyncProxy.SchedulerDependencyWorkers(
    scheduler, workerInputRetreiver);

function demoDependencyWorkersWithScheduler() {
    startDemoDependencyWorkers('scheduler_', schedulerDependencyWorkers);
}