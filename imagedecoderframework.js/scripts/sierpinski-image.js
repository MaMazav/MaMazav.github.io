'use strict';

var SierpinskiImage = (function SierpinskiImageClosure() {
	function SierpinskiImage() {
		var fetcher = this.createFetcher();
		var fetchManager = new imageDecoderFramework.FetchManager(fetcher);
		imageDecoderFramework.GridImageBase.call(this, fetchManager);
		this._decoderWorkers = null;
		this._imageParams = null;
	}
	
	SierpinskiImage.prototype = Object.create(imageDecoderFramework.GridImageBase.prototype);
    
	SierpinskiImage.prototype.getDecoderWorkers = function getDecoderWorkers() {
		if (this._decoderWorkers === null) {
			this._decoderWorkers = new asyncProxy.DependencyWorkers(this);
		}
		return this._decoderWorkers;
	};

    SierpinskiImage.prototype.getDecodeWorkerTypeOptions = function() {
        // Should provide absolute paths
		var htmlUrl = location.href.substring(0, location.href.lastIndexOf('/'));
        var baseUrl = htmlUrl + '/scripts/';
        var graphicslibraryPath = baseUrl + 'graphics-library.js';
        var sierpinskiDecoderPath = baseUrl + 'sierpinski-decoder-worker.js';
		var imageDecoderFrameworkPath = htmlUrl + '/../cdn/image-decoder-framework.dev.js';
        var absolutePaths = [
			imageDecoderFrameworkPath,
            graphicslibraryPath,
            sierpinskiDecoderPath];

        return {
            scriptsToImport: absolutePaths,
            ctorName: 'SierpinskiDecoderWorker',
            ctorArgs: []
        };
    };
	
	SierpinskiImage.prototype.createFetcher = function() {
		return new SierpinskiFetcher();
	};

    return SierpinskiImage;
})();