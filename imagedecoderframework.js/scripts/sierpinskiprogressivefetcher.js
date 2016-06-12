'use strict';

var SierpinskiProgressiveFetcher = (function SierpinskiProgressiveFetcherClosure() {
    function SierpinskiProgressiveFetcher(imageParams) {
        this._imageParams = imageParams;
        
        var lowestLevelWidth  = imageParams.internalTileWidth  * imageParams.lowestLevelTilesX;
        var lowestLevelHeight = imageParams.internalTileHeight * imageParams.lowestLevelTilesY;
        var minCarpetSize = Math.max(lowestLevelWidth, lowestLevelHeight);
        
        // Make sure the carpet size is a complete power of 3, so square edges lies exactly on pixels
        this._lowestLevelCarpetSize = Math.pow(3, Math.ceil(Math.log(minCarpetSize) / Math.log(3)));
    }
    
    var FetchStatus = {
        ACTIVE: 1,
        ABOUT_TO_STOP: 2,
        STOPPED: 3,
        FINISHED: 4
    }
        
    SierpinskiProgressiveFetcher.prototype.fetchProgressive = function fetchProgressive(imagePartParams, dataKeys, dataCallback, queryIsKeyNeedFetch, maxQuality) {
        var self = this;
		var resolveStop = null;
		var status = FetchStatus.ACTIVE;
		var nextStageMinSquareSize = SierpinskiImageParamsRetriever.LOWEST_QUALITY_SIERPINSKI_SQUARE_SIZE;
		var maxQualityMinSquareSize = maxQuality;

		var squaresCollectors = [];
		for (var i = 0; i < dataKeys.length; ++i) {
			var key = dataKeys[i];
			var carpetSize  = self._lowestLevelCarpetSize << key.level;
			var tileMinX = self._imageParams.internalTileWidth  * key.tileX;
			var tileMinY = self._imageParams.internalTileHeight * key.tileY;
			var tileMaxX = self._imageParams.internalTileWidth  * (key.tileX + 1);
			var tileMaxY = self._imageParams.internalTileHeight * (key.tileY + 1);

			squaresCollectors.push(graphicsLibrary.createSierpinskiSquaresCollector(
				tileMinX, tileMinY, tileMaxX, tileMaxY, carpetSize));
		}
		
        // Simulate 500ms time for each fetch stage
		var interval = setInterval(calculateSingleStageFetchResult, 500);
        
        function calculateSingleStageFetchResult() {
			if (status === FetchStatus.ABOUT_TO_STOP) {
				if (!resolveStop) {
                    throw 'Internal error: no resolveStop although stop requested';
				}
				clearInterval(interval);
                status = FetchStatus.STOPPED;
                resolveStop();
				return;
			}
			
			var isMaxQuality = nextStageMinSquareSize <= maxQualityMinSquareSize;
			
			for (var i = 0; i < dataKeys.length; ++i) {
				var key = dataKeys[i];
				if (!queryIsKeyNeedFetch(key)) {
					continue;
				}

				var squaresCollector = squaresCollectors[i];
				squaresCollector.collect(nextStageMinSquareSize);
				var squares = squaresCollector.getCollectedSquaresCoordinates();
				
				var fetchedData = {
					TILE_WIDTH : self._imageParams.internalTileWidth,
					TILE_HEIGHT: self._imageParams.internalTileHeight,
					LEVEL_WIDTH : self._imageParams.internalTileWidth  * self._imageParams.lowestLevelTilesX << key.level,
					LEVEL_HEIGHT: self._imageParams.internalTileHeight * self._imageParams.lowestLevelTilesY << key.level,
					sierpinskiSquaresCoordinates: squares
				};
				
				dataCallback(key, fetchedData, /*isFetchEnded=*/isMaxQuality);
			}
			
			if (isMaxQuality) {
				status = FetchStatus.FINISHED;
				clearInterval(interval);
			} else {
				nextStageMinSquareSize /= 3;
			}
		}
		
		return {
			stopAsync: function() {
                if (status === FetchStatus.STOPPED || status === FetchStatus.ABOUT_TO_STOP) {
                    throw 'Already requested top';
                }
				return new Promise(function(resolve, reject) {
                    switch (status) {
                        case FetchStatus.FINISHED:
                            resolve();
                            break;
                        case FetchStatus.ACTIVE:
                            status = FetchStatus.ABOUT_TO_STOP;
                            resolveStop = resolve;
                            break;
                        default:
                            throw 'Internal error: fetch status changed until promise loaded';
                    }
				});
			},
            
            resume: function() {
                if (status !== FetchStatus.STOPPED) {
                    throw 'Cannot resume non-stopped fetch';
                }
                status = FetchStatus.ACTIVE;
                interval = setInterval(calculateSingleStageFetchResult, 500);
            }
		};
    };
    
    SierpinskiProgressiveFetcher.prototype.getDataKeys = function getDataKeys(imagePartParams) {
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
    
    SierpinskiProgressiveFetcher.prototype.getHashCode = function getHashCode(tileKey) {
        return tileKey.tileX + tileKey.tileY * (this._imageParams.lowestLevelTilesX << tileKey.level);
    };

    SierpinskiProgressiveFetcher.prototype.isEqual = function isEqual(key1, key2) {
        return key1.tileX === key2.tileX && key1.tileY === key2.tileY;
    };

    return SierpinskiProgressiveFetcher;
})();