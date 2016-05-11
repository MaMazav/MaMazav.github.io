'use strict';

var DemoFetchClient = (function DemoFetchClientClosure() {
    var internalTileWidth;
    var internalTileHeight;
    var lowestLevelTilesX;
    var lowestLevelTilesY;
    var lowestLevelCarpetSize;
    
    function DemoFetchClient() {
        imageDecoderFramework.FetchClientBase.call(this);
    }
    
    DemoFetchClient.prototype = Object.create(imageDecoderFramework.FetchClientBase.prototype);
    
    DemoFetchClient.prototype.openInternal = function openInternal(url) {
        return new Promise(function(resolve, reject) {
            // A typical implementation will perform here some AJAX call before calling resolve()
            internalTileWidth = 256;
            internalTileHeight = 384;
            lowestLevelTilesX = 8;
            lowestLevelTilesY = 4;
            var sizeParams = {
                lowestLevelWidth : internalTileWidth  * lowestLevelTilesX,
                lowestLevelHeight: internalTileHeight * lowestLevelTilesY,
                imageLevel: 10
            };
            
            var minCarpetSize = Math.max(sizeParams.lowestLevelWidth, sizeParams.lowestLevelHeight);
            lowestLevelCarpetSize = Math.pow(3, Math.ceil(Math.log(minCarpetSize) / Math.log(3)));
            
            resolve(sizeParams);
        });
    };
    
    DemoFetchClient.prototype.fetchInternal = function fetch(key) {
        // Usually we fetch here some data from server, but for this example we'll only
        // perform a simple calculation of converting spatial position to gradient color
        return new Promise(function(resolve) {
            // A typical implementation will perform here some AJAX call before calling resolve().
            // Instead here we only calculate the sierpinski squares falls in the tile
            
            var carpetSize  = lowestLevelCarpetSize << key.level;
            var tileMinX = internalTileWidth  * key.tileX;
            var tileMinY = internalTileHeight * key.tileY;
            var tileMaxX = internalTileWidth  * (key.tileX + 1);
            var tileMaxY = internalTileHeight * (key.tileY + 1);
            
            var sierpinskiSquaresCoordinates = collectSierpinskiSquares(
                tileMinX, tileMinY, tileMaxX, tileMaxY, carpetSize);
            
            resolve({
                TILE_WIDTH: internalTileWidth,
                TILE_HEIGHT: internalTileHeight,
                minCb: 256 * key.normalizedMinX,
                minCr: 256 * key.normalizedMinY,
                maxCb: 256 * key.normalizedMaxX,
                maxCr: 256 * key.normalizedMaxY,
                sierpinskiSquaresCoordinates: sierpinskiSquaresCoordinates
            });
        });
    };
    
    DemoFetchClient.prototype.getDataKeysInternal = function getDataKeysInternal(imagePartParams) {
        var result = [];
        var levelTilesX = lowestLevelTilesX << imagePartParams.level;
        var levelTilesY = lowestLevelTilesY << imagePartParams.level;
        var minTileX = Math.max(0, Math.floor(imagePartParams.minX / internalTileWidth ));
        var minTileY = Math.max(0, Math.floor(imagePartParams.minY / internalTileHeight));
        var maxTileX = Math.min(levelTilesX, Math.ceil(imagePartParams.maxXExclusive / internalTileWidth ));
        var maxTileY = Math.min(levelTilesY, Math.ceil(imagePartParams.maxYExclusive / internalTileHeight));
        for (var tileX = minTileX; tileX < maxTileX; ++tileX) {
            var normalizedMinX = tileX / levelTilesX;
            var normalizedMaxX = (tileX + 1) / levelTilesX;
            for (var tileY = minTileY; tileY < maxTileY; ++tileY) {
                result.push({
                    tileX: tileX,
                    tileY: tileY,
                    normalizedMinX: normalizedMinX,
                    normalizedMaxX: normalizedMaxX,
                    normalizedMinY: tileY / levelTilesY,
                    normalizedMaxY: (tileY + 1) / levelTilesY,
                    level: imagePartParams.level
                });
            }
        }
        return result;
    };
    
    DemoFetchClient.prototype.getHashCode = function getHashCode(tileKey) {
        return tileKey.tileX + tileKey.tileY * (lowestLevelTilesX << tileKey.level);
    };

    DemoFetchClient.prototype.isEqual = function getHashCode(key1, key2) {
        return key1.tileX === key2.tileX && key1.tileY === key2.tileY;
    };

    return DemoFetchClient;
})();