'use strict';

var SimpleDemoFetchClient = (function SimpleDemoFetchClientClosure() {
    var internalTileWidth;
    var internalTileHeight;
    var lowestLevelTilesX;
    var lowestLevelTilesY;
    
    function SimpleDemoFetchClient() {
        imageDecoderFramework.FetchClientBase.call(this);
    }
    
    SimpleDemoFetchClient.prototype = Object.create(imageDecoderFramework.FetchClientBase.prototype);
    
    SimpleDemoFetchClient.prototype.openInternal = function openInternal(url) {
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
            
            resolve(sizeParams);
        });
    };
    
    SimpleDemoFetchClient.prototype.fetchInternal = function fetch(key) {
        // Usually we fetch here some data from server, but for this example we'll only
        // returns simple object.
        return new Promise(function(resolve) {
            // A typical implementation will perform here some AJAX call before calling resolve().
            // Instead here we only return some data which is important to the decoder calculation.
            
            resolve({
                TILE_WIDTH : internalTileWidth,
                TILE_HEIGHT: internalTileHeight
            });
        });
    };
    
    SimpleDemoFetchClient.prototype.getDataKeysInternal = function getDataKeysInternal(imagePartParams) {
		// A classic spatial tile calculation of a grid-tiled image
        var result = [];
        var levelTilesX = lowestLevelTilesX << imagePartParams.level;
        var levelTilesY = lowestLevelTilesY << imagePartParams.level;
        var minTileX = Math.max(0, Math.floor(imagePartParams.minX / internalTileWidth ));
        var minTileY = Math.max(0, Math.floor(imagePartParams.minY / internalTileHeight));
        var maxTileX = Math.min(levelTilesX, Math.ceil(imagePartParams.maxXExclusive / internalTileWidth ));
        var maxTileY = Math.min(levelTilesY, Math.ceil(imagePartParams.maxYExclusive / internalTileHeight));
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
    
    SimpleDemoFetchClient.prototype.getHashCode = function getHashCode(tileKey) {
        return tileKey.tileX + tileKey.tileY * (lowestLevelTilesX << tileKey.level);
    };

    SimpleDemoFetchClient.prototype.isEqual = function getHashCode(key1, key2) {
        return key1.tileX === key2.tileX && key1.tileY === key2.tileY;
    };

    return SimpleDemoFetchClient;
})();