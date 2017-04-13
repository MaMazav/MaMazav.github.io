'use strict';

var GridFetcher = (function GridFetcherClosure() {
    function GridFetcher() {
		imageDecoderFramework.GridFetcherBase.call(this);
        this._imageParams = null;
        this._levelsCache = [];
    }
	
	GridFetcher.prototype = Object.create(imageDecoderFramework.GridFetcherBase.prototype);
    
    GridFetcher.prototype.open = function(url) {
        var self = this;
        this._url = url;
        return graphicsLibrary.ajax(url + '/image-props.json').then(function(imageParams) {
            imageParams.imageLevel = imageParams.levels - 1;
            imageParams.imageWidth  = imageParams.tileWidth  * imageParams.lowestLevelTilesX * Math.pow(2, imageParams.imageLevel);
            imageParams.imageHeight = imageParams.tileHeight * imageParams.lowestLevelTilesY * Math.pow(2, imageParams.imageLevel);
            imageParams.numResolutionLevelsForLimittedViewer = imageParams.levels;
            imageParams.lowestQuality = 'arbitrary value';
            imageParams.highestQuality = 'Another arbitrary value';
			
			self._imageParams = imageParams;
            return imageParams;
        });
    };
    
    GridFetcher.prototype.fetchTile = function fetchTile(level, tileX, tileY, fetchTask) {
        var promise = this._levelsCache[level];
        if (!promise) {
            promise = graphicsLibrary.ajax(this._url + '/level' + level + '.json');
            this._levelsCache[level] = promise;
        }
		
        promise.then(function(levelData) {
            fetchTask.onData(levelData.cols[tileX].rows[tileY]);
			fetchTask.onTerminated();
        });
    };
	
	GridFetcher.prototype.getImageParams = function getImageParams() {
		return this._imageParams;
	};
    
    return GridFetcher;
})();