'use strict';

var DemoFetchClient = (function DemoFetchClientClosure() {
    var INTERNAL_TILE_WIDTH = 256;
    var INTERNAL_TILE_HEIGHT = 384;
    var TILES_IN_LEVEL_X = [32, 16, 8];
    var TILES_IN_LEVEL_Y = [12, 6, 3];
    
    var sizeParams = {
        numLevels: 3,
        levelWidths : [
            TILES_IN_LEVEL_X[0] * INTERNAL_TILE_WIDTH,
            TILES_IN_LEVEL_X[1] * INTERNAL_TILE_WIDTH,
            TILES_IN_LEVEL_X[2] * INTERNAL_TILE_WIDTH
        ],
        levelHeights: [
            TILES_IN_LEVEL_Y[0] * INTERNAL_TILE_HEIGHT,
            TILES_IN_LEVEL_Y[1] * INTERNAL_TILE_HEIGHT,
            TILES_IN_LEVEL_Y[2] * INTERNAL_TILE_HEIGHT
        ]
    };
    
    function DemoFetchClient() {
		imageDecoderFramework.FetchClientBase.call(this);
    }
    
    DemoFetchClient.prototype = Object.create(imageDecoderFramework.FetchClientBase.prototype);
    
    DemoFetchClient.prototype.openInternal = function openInternal(url) {
        return new Promise(function(resolve, reject) {
            resolve(sizeParams);
        });
    };
    
    DemoFetchClient.prototype.fetchInternal = function fetch(dataKey) {
        // Usually we fetch here some data from server, but for this example we'll only
		// perform a simple calculation of converting spatial position to gradient color
		return new Promise(function(resolve) {
			var levelWidth  = sizeParams.levelWidths [dataKey.level];
			var levelHeight = sizeParams.levelHeights[dataKey.level];
			resolve({
				TILE_WIDTH: INTERNAL_TILE_WIDTH,
				TILE_HEIGHT: INTERNAL_TILE_HEIGHT,
				//minX: dataKey.tileX * INTERNAL_TILE_WIDTH,
				//minY: dataKey.tileY * INTERNAL_TILE_HEIGHT,
				//maxXExclusive: (dataKey.tileX + 1) * INTERNAL_TILE_WIDTH,
				//maxYExclusive: (dataKey.tileY + 1) * INTERNAL_TILE_HEIGHT,
				minCb: 256 * dataKey.normalizedMinX,
				minCr: 256 * dataKey.normalizedMinY,
				maxCb: 256 * dataKey.normalizedMaxX,
				maxCr: 256 * dataKey.normalizedMaxY
			});
		});
    };
    
    DemoFetchClient.prototype.getDataKeysInternal = function getDataKeysInternal(imagePartParams) {
        var result = [];
		var levelWidth  = sizeParams.levelWidths [imagePartParams.numResolutionLevelsToCut];
		var levelHeight = sizeParams.levelHeights[imagePartParams.numResolutionLevelsToCut];
		var levelTilesX = TILES_IN_LEVEL_X[imagePartParams.numResolutionLevelsToCut];
		var levelTilesY = TILES_IN_LEVEL_Y[imagePartParams.numResolutionLevelsToCut];
		var minTileX = Math.max(0, Math.floor(imagePartParams.minX / INTERNAL_TILE_WIDTH ));
		var minTileY = Math.max(0, Math.floor(imagePartParams.minY / INTERNAL_TILE_HEIGHT));
		var maxTileX = Math.min(levelTilesX, Math.ceil(imagePartParams.maxXExclusive / INTERNAL_TILE_WIDTH ));
		var maxTileY = Math.min(levelTilesY, Math.ceil(imagePartParams.maxYExclusive / INTERNAL_TILE_HEIGHT));
		for (var tileX = minTileX; tileX < maxTileX; ++tileX) {
			var normalizedMinX = tileX / levelTilesX;
			var normalizedMaxX = (tileX + 1) / levelTilesX;
			for (var tileY = minTileY; tileY < maxTileY; ++tileY) {
				result.push({
					tileX: tileX,
					tileY: tileY,
					normalizedMinX: normalizedMinX,
					normalizedMaxX: normalizedMaxX,
					normalizedMinY: tileY / INTERNAL_TILE_HEIGHT,
					normalizedMaxY: (tileY + 1) / INTERNAL_TILE_HEIGHT
				});
			}
		}
		return result;
    };
    
	DemoFetchClient.prototype.getHashCode = function getHashCode(tileKey) {
		return tileKey.tileX + tileKey.tileY * TILES_IN_LEVEL_X[0]
	};

	DemoFetchClient.prototype.isEqual = function getHashCode(key1, key2) {
		return key1.tileX === key2.tileX && key1.tileY === key2.tileY;
	};

    return DemoFetchClient;
})();