'use strict';

var GridImage = (function GridImageClosure() {
    function GridImage() {
		var fetcher = new GridFetcher();
		imageDecoderFramework.GridImageBase.call(this, fetcher);
        
		this._imageParams = null;
		this._levels = 0;
        this._levelCalculator = null;
    }
	
	GridImage.prototype = Object.create(imageDecoderFramework.GridImageBase.prototype);
	
	GridImage.prototype.opened = function opened(imageDecoder) {
        // Need to override opened() only because getLevelCalculator() is overriden
        imageDecoderFramework.GridImageBase.prototype.opened.call(this, imageDecoder);
        this._imageParams = imageDecoder.getImageParams();
    };
    
    GridImage.prototype.getLevelCalculator = function getLevelCalculator() {
		if (this._levelCalculator === null) {
            var maxLevel = this._imageParams.internals.levels - 1;
			this._levelCalculator = new LimittedGridLevelCalculator(this._imageParams, 0, maxLevel);
		}
        return this._levelCalculator;
    };

    GridImage.prototype.getDecodeWorkerTypeOptions = function() {
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
