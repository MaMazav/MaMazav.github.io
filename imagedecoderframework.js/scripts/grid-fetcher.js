'use strict';

var GridFetcher = (function GridFetcherClosure() {
    function GridFetcher() {
        this._imageParams = null;
        this._levelsCache = [];
    }
    
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
    
    GridFetcher.prototype.fetch = function fetch(imagePartParams) {
        var tilesRange = GridImage.getTilesRange(this._imageParams, imagePartParams);
        
        var promises = [];
        for (var tileX = tilesRange.minTileX; tileX < tilesRange.maxTileX; ++tileX) {
            for (var tileY = tilesRange.minTileY; tileY < tilesRange.maxTileY; ++tileY) {
                var promise = this._loadTile(imagePartParams.level, tileX, tileY);
                promises.push(promise);
            }
        }
        
        return Promise.all(promises);
    };
    
    GridFetcher.prototype._loadTile = function loadTile(level, tileX, tileY) {
        var promise = this._levelsCache[level];
        if (!this._levelsCache[level]) {
            promise = graphicsLibrary.ajax(this._url + '/level' + level + '.json');
            this._levelsCache[level] = promise;
        }
        return promise.then(function(levelData) {
            return {
                tileKey: {
					fetchWaitTask: true,
                    tileX: tileX,
                    tileY: tileY,
                    level: level
                },
                content: levelData.cols[tileX].rows[tileY]
            };
        });
    };
    
    return GridFetcher;
})();