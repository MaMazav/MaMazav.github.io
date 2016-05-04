'use strict';

var DemoFetchClient = (function DemoFetchClientClosure() {
    var INTERNAL_TILE_WIDTH = 256;
    var INTERNAL_TILE_HEIGHT = 384;
	var LEVELS = 10;
	var LOWEST_LEVEL_TILES_X = 8;
	var HIGHEST_LEVEL_TILES_Y = 3;
	
	var TILES_IN_LEVEL_X = new Array(LEVELS);
	var TILES_IN_LEVEL_Y = new Array(LEVELS);
	
	var sizeParams = {
		numLevels: LEVELS,
		levelWidths: new Array(LEVELS),
		levelHeights: new Array(LEVELS)
	};
	
	TILES_IN_LEVEL_X[LEVELS - 1] = 8;
	TILES_IN_LEVEL_Y[LEVELS - 1] = 3;
	
	for (var i = LEVELS - 1; i >= 0; --i) {
		if (i < LEVELS - 1) {
			TILES_IN_LEVEL_X[i] = TILES_IN_LEVEL_X[i + 1] * 2;
			TILES_IN_LEVEL_Y[i] = TILES_IN_LEVEL_Y[i + 1] * 2;
		}
		sizeParams.levelWidths [i] = TILES_IN_LEVEL_X[i] * INTERNAL_TILE_WIDTH;
		sizeParams.levelHeights[i] = TILES_IN_LEVEL_Y[i] * INTERNAL_TILE_HEIGHT;
	}
    
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
					normalizedMinY: tileY / levelTilesY,
					normalizedMaxY: (tileY + 1) / levelTilesY,
					level: imagePartParams.numResolutionLevelsToCut
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