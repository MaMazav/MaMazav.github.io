'use strict';

var GridFetcher = (function GridFetcherClosure() {
    function GridFetcher(imageParams) {
        imageDecoderFramework.SimpleFetcherBase.call(this);
        this._imageParams = imageParams;
    }
    
    GridFetcher.prototype = Object.create(imageDecoderFramework.SimpleFetcherBase.prototype);
    
    GridFetcher.prototype.fetchInternal = function fetch(key) {
        var self = this;
        return new Promise(function(resolve) {
            // A typical implementation will perform here some AJAX call before calling resolve().
            // Instead here we only return some data which is important to the decoder calculation.
            
            resolve({
                TILE_WIDTH : self._imageParams.internalTileWidth,
                TILE_HEIGHT: self._imageParams.internalTileHeight
            });
        });
    };
    
    GridFetcher.prototype.getDataKeysInternal = function getDataKeysInternal(imagePartParams) {
		// A classic spatial tile calculation of a grid-tiled image
        var result = [];
        var levelTilesX = this._imageParams.lowestLevelTilesX << imagePartParams.level;
        var levelTilesY = this._imageParams.lowestLevelTilesY << imagePartParams.level;
        var minTileX = Math.max(0, Math.floor(imagePartParams.minX / this._imageParams.internalTileWidth ));
        var minTileY = Math.max(0, Math.floor(imagePartParams.minY / this._imageParams.internalTileHeight));
        var maxTileX = Math.min(levelTilesX, Math.ceil(imagePartParams.maxXExclusive / this._imageParams.internalTileWidth ));
        var maxTileY = Math.min(levelTilesY, Math.ceil(imagePartParams.maxYExclusive / this._imageParams.internalTileHeight));
        for (var tileX = minTileX; tileX < maxTileX; ++tileX) {
            for (var tileY = minTileY; tileY < maxTileY; ++tileY) {
                result.push({
                    tileX: tileX,
                    tileY: tileY,
                    level: imagePartParams.level
                });
            }
        }
        return result;
    };
    
    GridFetcher.prototype.getHashCode = function getHashCode(tileKey) {
        return tileKey.tileX + tileKey.tileY * (this._imageParams.lowestLevelTilesX << tileKey.level);
    };

    GridFetcher.prototype.isEqual = function getHashCode(key1, key2) {
        return key1.tileX === key2.tileX && key1.tileY === key2.tileY;
    };

    return GridFetcher;
})();