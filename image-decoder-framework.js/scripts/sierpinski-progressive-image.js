var SierpinskiProgressiveImage = (function SierpinskiProgressiveImageClosure() {
	function SierpinskiProgressiveImage(options) {
		SierpinskiImage.call(this, options);
	}
	
	SierpinskiProgressiveImage.prototype = Object.create(SierpinskiImage.prototype);
	
	SierpinskiProgressiveImage.prototype.createFetcher = function() {
		var htmlUrl = location.href.substring(0, location.href.lastIndexOf('/'));
        var baseUrl = htmlUrl + '/scripts/';
        var graphicsLibraryPath = baseUrl + 'graphics-library.js';
        var sierpinskiFetcherPath = baseUrl + 'sierpinski-fetcher.js';
        var sierpinskiProgressiveFetcherPath = baseUrl + 'sierpinski-progressive-fetcher.js';
		var imageDecoderFrameworkPath = htmlUrl + '/../cdn/image-decoder-framework.dev.debug.js';
        var scriptsToImport = [
			imageDecoderFrameworkPath,
            graphicsLibraryPath,
			sierpinskiFetcherPath,
            sierpinskiProgressiveFetcherPath];
			
		return {
            scriptsToImport: scriptsToImport,
            ctorName: 'SierpinskiProgressiveFetcher'
        };
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