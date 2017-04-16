var workerInputRetreiver = createPascalCellInputRetreiver();

var scheduler = new resourceScheduler.PriorityScheduler(
    function createDummyResource() {
        return {};
    },
    /*jobsLimit=*/2,
    /*prioritizer=*/{ getPriority: function(task) {
        return task.MY_PRIORITY;
    }});

var schedulerDependencyWorkers = new asyncProxy.SchedulerDependencyWorkers(
    scheduler, workerInputRetreiver);

function demoDependencyWorkersWithScheduler() {
    startDemoDependencyWorkers('scheduler_', schedulerDependencyWorkers);
}