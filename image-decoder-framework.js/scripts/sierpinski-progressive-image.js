var SierpinskiProgressiveImage = (function SierpinskiProgressiveImageClosure() {
	function SierpinskiProgressiveImage(options) {
		SierpinskiImage.call(this, options);
	}
	
	SierpinskiProgressiveImage.prototype = Object.create(SierpinskiImage.prototype);
	
	SierpinskiProgressiveImage.prototype.createFetcher = function() {
		return new SierpinskiProgressiveFetcher();
	};
	
	SierpinskiProgressiveImage.prototype.decodeTaskStarted = function decodeTaskStarted(task) {
		var self = this;
		var isTerminated = false;
		var decodedQuality;
		
		task.on('allDependTasksTerminated', function() {
			isTerminated = true;
			self.dataReadyForDecode(task);
			task.terminate();
		});
		
		task.on('dependencyTaskData', function(data, key) {
			if (isTerminated) {
				return;
			}
			
			var lowestQuality;
			for (var i = 0; i < task.dependTaskKeys.length; ++i) {
				if (!task.dependTaskResults[i] || task.dependTaskResults[i].sierpinskiQuality === decodedQuality) {
					return;
				}
				if (i === 0 || task.dependTaskResults[i].sierpinskiQuality > lowestQuality) {
					lowestQuality = task.dependTaskResults[i].sierpinskiQuality;
				}
			}
			
			decodedQuality = lowestQuality;
			self.dataReadyForDecode(task);
		});
	};

	return SierpinskiProgressiveImage;
})();