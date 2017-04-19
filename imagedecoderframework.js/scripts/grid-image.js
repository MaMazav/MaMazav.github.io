var GridImage = (function GridImage() {
    function GridImage() {
		var fetcher = new GridFetcher();
		var fetchManager = new imageDecoderFramework.FetchManager(fetcher);
		imageDecoderFramework.GridImageBase.call(this, fetchManager);
		this._decoderWorkers = null;
		this._imageParams = null;
		this._levels = 0;
    }
	
	GridImage.prototype = Object.create(imageDecoderFramework.GridImageBase.prototype);
	
	GridImage.prototype.getLevel = function getLevel(regionImageLevel) {
		if (this._imageParams === null) {
			this._imageParams = this._fetchManager.getImageParams();
			this._levels = this._imageParams.internals.levels;
		}
		// Perform calculation of level according to resolution, as implemented in base class
		var level = imageDecoderFramework.GridImageBase.prototype.getLevel.call(this, regionImageLevel);
		
		// Limit level to the predefined range
		var limittedLevel = Math.max(0, Math.min(this._levels - 1, level));
		
		return limittedLevel;
	};
    
	GridImage.prototype.getDecoderWorkers = function getDecoderWorkers() {
		if (this._decoderWorkers === null) {
			this._decoderWorkers = new asyncProxy.DependencyWorkers(this);
		}
		return this._decoderWorkers;
	};

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