var GridImage = (function GridImage() {
    function GridImage() {
		var fetcher = new GridFetcher();
		var fetchManager = new imageDecoderFramework.FetchManager(fetcher);
		imageDecoderFramework.GridImageBase.call(this, fetchManager);
    }
	
	GridImage.prototype = Object.create(imageDecoderFramework.GridImageBase.prototype);
    
    GridImage.prototype.getDecodeWorkerTypeOptions = function(taskType) {
        // Should provide absolute paths
		var htmlUrl = location.href.substring(0, location.href.lastIndexOf('/'));
        var baseUrl = htmlUrl + '/scripts/';
        var graphicslibraryPath = baseUrl + 'graphics-library.js';
        var gridDecoderPath = baseUrl + 'grid-decoder-worker.js';
		var imageDecoderFrameworkPath = htmlUrl + '/../cdn/image-decoder-framework.dev.js';
        var absolutePaths = [
			imageDecoderFrameworkPath,
            graphicslibraryPath,
            gridDecoderPath];

        return {
            scriptsToImport: absolutePaths,
            ctorName: 'GridDecoderWorker',
            ctorArgs: []
        };
    };

    return GridImage;
})();
