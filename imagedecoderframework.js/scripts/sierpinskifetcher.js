'use strict';

var SierpinskiFetcher = (function SierpinskiFetcherClosure() {
    function SierpinskiFetcher(imageParams) {
        imageDecoderFramework.SimpleFetcherBase.call(this);
        
        this._imageParams = imageParams;
        
        var lowestLevelWidth  = imageParams.internalTileWidth  * imageParams.lowestLevelTilesX;
        var lowestLevelHeight = imageParams.internalTileHeight * imageParams.lowestLevelTilesY;
        var minCarpetSize = Math.max(lowestLevelWidth, lowestLevelHeight);
        
        // Make sure the carpet size is a complete power of 3, so square edges lies exactly on pixels
        this._lowestLevelCarpetSize = Math.pow(3, Math.ceil(Math.log(minCarpetSize) / Math.log(3)));
    }
    
    SierpinskiFetcher.prototype = Object.create(imageDecoderFramework.SimpleFetcherBase.prototype);
    
    SierpinskiFetcher.prototype.fetchInternal = function fetch(key) {
        var self = this;
        return new Promise(function(resolve) {
            // A typical implementation will perform here some AJAX call before calling resolve().
            // Instead here we only calculate the sierpinski squares falls in the tile
            
            var carpetSize  = self._lowestLevelCarpetSize << key.level;
            var tileMinX = self._imageParams.internalTileWidth  * key.tileX;
            var tileMinY = self._imageParams.internalTileHeight * key.tileY;
            var tileMaxX = self._imageParams.internalTileWidth  * (key.tileX + 1);
            var tileMaxY = self._imageParams.internalTileHeight * (key.tileY + 1);
            
            var sierpinskiSquaresCoordinates = graphicsLibrary.collectSierpinskiSquares(
                tileMinX, tileMinY, tileMaxX, tileMaxY, carpetSize);
            
            resolve({
                TILE_WIDTH : self._imageParams.internalTileWidth,
                TILE_HEIGHT: self._imageParams.internalTileHeight,
                LEVEL_WIDTH : self._imageParams.internalTileWidth  * self._imageParams.lowestLevelTilesX << key.level,
                LEVEL_HEIGHT: self._imageParams.internalTileHeight * self._imageParams.lowestLevelTilesY << key.level,
                sierpinskiSquaresCoordinates: sierpinskiSquaresCoordinates
            });
        });
    };
    
    SierpinskiFetcher.prototype.getDataKeysInternal = function getDataKeysInternal(imagePartParams) {
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
    
    SierpinskiFetcher.prototype.getHashCode = function getHashCode(tileKey) {
        return tileKey.tileX + tileKey.tileY * (this._imageParams.lowestLevelTilesX << tileKey.level);
    };

    SierpinskiFetcher.prototype.isEqual = function getHashCode(key1, key2) {
        return key1.tileX === key2.tileX && key1.tileY === key2.tileY;
    };

    return SierpinskiFetcher;
})();