'use strict';

/* global console: false */

var SierpinskiFetcher = (function SierpinskiFetcherClosure() {
    function SierpinskiFetcher() {
        imageDecoderFramework.GridFetcherBase.call(this);
        var lowestLevelTilesX = 8;
        var lowestLevelTilesY = 4;
        var levels = 10;
        var tileWidth  = 256;
        var tileHeight = 384;
        this._imageParams = {
            imageLevel : levels - 1,
            imageWidth  : tileWidth  * lowestLevelTilesX * Math.pow(2, levels - 1),
            imageHeight : tileHeight * lowestLevelTilesY * Math.pow(2, levels - 1),
            numResolutionLevelsForLimittedViewer : levels,
            lowestQuality  : 81,
            highestQuality : 4,
            tileWidth: tileWidth,
            tileHeight: tileHeight
        };

        var lowestLevelWidth  = tileWidth  * lowestLevelTilesX;
        var lowestLevelHeight = tileHeight * lowestLevelTilesY;
        var minCarpetSize = Math.max(lowestLevelWidth, lowestLevelHeight);
        
        // Make sure the carpet size is a complete power of 3, so square edges lies exactly on pixels
        this._level0CarpetSize = Math.pow(3, Math.ceil(Math.log(minCarpetSize) / Math.log(3)));
    }
    
    SierpinskiFetcher.prototype = Object.create(imageDecoderFramework.GridFetcherBase.prototype);

    SierpinskiFetcher.prototype.open = function open() {
        return Promise.resolve(this._imageParams);
    }
    
    SierpinskiFetcher.prototype.getImageParams = function getImageParams() {
        return this._imageParams;
    };
    
    SierpinskiFetcher.prototype.fetchTile = function fetchTile(level, tileX, tileY, fetchTask, maxQuality) {
        var tileMinX = this._imageParams.tileWidth * tileX;
        var tileMaxX = this._imageParams.tileWidth * (tileX + 1);
        var tileMinY = this._imageParams.tileHeight * tileY;
        var tileMaxY = this._imageParams.tileHeight * (tileY + 1);
        var carpetSize  = level >= 0 ? this._level0CarpetSize << level : this._level0CarpetSize >> -level;
        var sierpinskiCollector = graphicsLibrary.createSierpinskiSquaresCollector(
            tileMinX, tileMinY, tileMaxX, tileMaxY, carpetSize);

        var levelFactor = Math.pow(2, level - this._imageParams.imageLevel);
        var levelWidth  = this._imageParams.imageWidth  * levelFactor;
        var levelHeight = this._imageParams.imageHeight * levelFactor;
        
        this.fetchTileInternal(fetchTask, sierpinskiCollector, levelWidth, levelHeight, maxQuality);
    };
    
    SierpinskiFetcher.prototype.fetchTileInternal = function(fetchTask, sierpinskiCollector, levelWidth, levelHeight, maxQuality) {
        sierpinskiCollector.collect();
        var sierpinskiSquaresCoordinates = sierpinskiCollector.getCollectedSquaresCoordinates();
        
        fetchTask.dataReady({
            sierpinskiSquaresCoordinates: sierpinskiSquaresCoordinates,
            levelWidth:  levelWidth,
            levelHeight: levelHeight
        });
        fetchTask.terminate();
    };

    return SierpinskiFetcher;
})();