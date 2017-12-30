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
        return graphicsLibrary.ajax(url + '/image-props.json').then(function(imageProps) {
            var imageLevel = imageProps.levels - 1;
            self._imageParams = {
                // Mandatory fields
                imageLevel : imageLevel,
                imageWidth  : imageProps.tileWidth  * imageProps.lowestLevelTilesX * Math.pow(2, imageLevel),
                imageHeight : imageProps.tileHeight * imageProps.lowestLevelTilesY * Math.pow(2, imageLevel),
                numResolutionLevelsForLimittedViewer : imageProps.levels,
                lowestQuality  : 'arbitrary value',
                highestQuality : 'Another arbitrary value',
                
                // Mandatory fields for GridImage
                tileWidth : imageProps.tileWidth,
                tileHeight: imageProps.tileHeight,
                
                // Custom data
                internals: { levels: imageProps.levels }
            };
            
            return self._imageParams;
        });
    };
    
    GridFetcher.prototype.fetchTile = function fetchTile(level, tileX, tileY, fetchTask) {
        var promise = this._levelsCache[level];
        if (!promise) {
            promise = graphicsLibrary.ajax(this._url + '/level' + level + '.json');
            this._levelsCache[level] = promise;
        }
        
        promise.then(function(levelData) {
            fetchTask.dataReady(levelData.cols[tileX].rows[tileY]);
            fetchTask.terminate();
        });
    };
    
    GridFetcher.prototype.getImageParams = function getImageParams() {
        return this._imageParams;
    };
    
    return GridFetcher;
})();