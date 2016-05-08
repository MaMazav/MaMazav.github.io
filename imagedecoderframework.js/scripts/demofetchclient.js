'use strict';

var DemoFetchClient = (function DemoFetchClientClosure() {
    var internalTileWidth;
    var internalTileHeight;
    var lowestLevelTilesX;
    var lowestLevelTilesY;
    
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
            resolve(sizeParams);
        });
    };
    
    DemoFetchClient.prototype.fetchInternal = function fetch(dataKey) {
        // Usually we fetch here some data from server, but for this example we'll only
        // perform a simple calculation of converting spatial position to gradient color
        return new Promise(function(resolve) {
            // A typical implementation will perform here some AJAX call before calling resolve()
            resolve({
                TILE_WIDTH: internalTileWidth,
                TILE_HEIGHT: internalTileHeight,
                minCb: 256 * dataKey.normalizedMinX,
                minCr: 256 * dataKey.normalizedMinY,
                maxCb: 256 * dataKey.normalizedMaxX,
                maxCr: 256 * dataKey.normalizedMaxY
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