'use strict';

var SierpinskiProgressiveFetcher = (function SierpinskiProgressiveFetcherClosure() {
    var LOWEST_QUALITY_SIERPINSKI_SQUARE_SIZE = 81;
    var HIGHEST_QUALITY_SIERPINSKI_SQUARE_SIZE = 4;

    var FetchStatus = {
        ACTIVE: 1,
        ABOUT_TO_STOP: 2,
        STOPPED: 3,
        FINISHED: 4
    };
    
    function SierpinskiProgressiveFetcher() {
        SierpinskiFetcher.call(this);
    }
    
    SierpinskiProgressiveFetcher.prototype = Object.create(SierpinskiFetcher.prototype);
    
    SierpinskiProgressiveFetcher.prototype.fetchTileInternal = function(fetchTask, sierpinskiCollector, levelWidth, levelHeight, maxQuality) {
        var self = this;
        var resolveStop = null;
        var status = FetchStatus.ACTIVE;
        var nextStageMinSquareSize = LOWEST_QUALITY_SIERPINSKI_SQUARE_SIZE;
        var maxQualityMinSquareSize = maxQuality || HIGHEST_QUALITY_SIERPINSKI_SQUARE_SIZE;
        
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
            sierpinskiCollector.collect(nextStageMinSquareSize);
            var squares = sierpinskiCollector.getCollectedSquaresCoordinates();

            fetchTask.dataReady({
                sierpinskiSquaresCoordinates: squares,
                levelWidth:  levelWidth,
                levelHeight: levelHeight,
                
                sierpinskiQuality: nextStageMinSquareSize
            });

            if (isMaxQuality) {
                status = FetchStatus.FINISHED;
                fetchTask.terminate();
                clearInterval(interval);
            } else {
                nextStageMinSquareSize /= 3;
            }
        }
    };
    
    //SierpinskiProgressiveFetcher.prototype.fetchProgressive = function fetchProgressive(imagePartParams, dataKeys, dataCallback, queryIsKeyNeedFetch, maxQuality) {
    //    var self = this;
    //    var resolveStop = null;
    //    var status = FetchStatus.ACTIVE;
    //    var nextStageMinSquareSize = SierpinskiImageParamsRetriever.LOWEST_QUALITY_SIERPINSKI_SQUARE_SIZE;
    //    var maxQualityMinSquareSize = maxQuality;
    //
    //    var squaresCollectors = [];
    //    for (var i = 0; i < dataKeys.length; ++i) {
    //        var key = dataKeys[i];
    //        var carpetSize  = self._lowestLevelCarpetSize << key.level;
    //        var tileMinX = self._imageParams.internalTileWidth  * key.tileX;
    //        var tileMinY = self._imageParams.internalTileHeight * key.tileY;
    //        var tileMaxX = self._imageParams.internalTileWidth  * (key.tileX + 1);
    //        var tileMaxY = self._imageParams.internalTileHeight * (key.tileY + 1);
    //
    //        squaresCollectors.push(graphicsLibrary.createSierpinskiSquaresCollector(
    //            tileMinX, tileMinY, tileMaxX, tileMaxY, carpetSize));
    //    }
    //    
    //    // Simulate 500ms time for each fetch stage
    //    var interval = setInterval(calculateSingleStageFetchResult, 500);
    //    
    //    function calculateSingleStageFetchResult() {
    //        if (status === FetchStatus.ABOUT_TO_STOP) {
    //            if (!resolveStop) {
    //                throw 'Internal error: no resolveStop although stop requested';
    //            }
    //            clearInterval(interval);
    //            status = FetchStatus.STOPPED;
    //            resolveStop();
    //            return;
    //        }
    //        
    //        var isMaxQuality = nextStageMinSquareSize <= maxQualityMinSquareSize;
    //        
    //        for (var i = 0; i < dataKeys.length; ++i) {
    //            var key = dataKeys[i];
    //            if (!queryIsKeyNeedFetch(key)) {
    //                continue;
    //            }
    //
    //            var squaresCollector = squaresCollectors[i];
    //            squaresCollector.collect(nextStageMinSquareSize);
    //            var squares = squaresCollector.getCollectedSquaresCoordinates();
    //            
    //            var fetchedData = {
    //                TILE_WIDTH : self._imageParams.internalTileWidth,
    //                TILE_HEIGHT: self._imageParams.internalTileHeight,
    //                LEVEL_WIDTH : self._imageParams.internalTileWidth  * self._imageParams.lowestLevelTilesX << key.level,
    //                LEVEL_HEIGHT: self._imageParams.internalTileHeight * self._imageParams.lowestLevelTilesY << key.level,
    //                sierpinskiSquaresCoordinates: squares
    //            };
    //            
    //            dataCallback(key, fetchedData, /*isFetchEnded=*/isMaxQuality);
    //        }
    //        
    //        if (isMaxQuality) {
    //            status = FetchStatus.FINISHED;
    //            clearInterval(interval);
    //        } else {
    //            nextStageMinSquareSize /= 3;
    //        }
    //    }
    //    
    //    return {
    //        stopAsync: function() {
    //            if (status === FetchStatus.STOPPED || status === FetchStatus.ABOUT_TO_STOP) {
    //                throw 'Already requested top';
    //            }
    //            return new Promise(function(resolve, reject) {
    //                switch (status) {
    //                    case FetchStatus.FINISHED:
    //                        resolve();
    //                        break;
    //                    case FetchStatus.ACTIVE:
    //                        status = FetchStatus.ABOUT_TO_STOP;
    //                        resolveStop = resolve;
    //                        break;
    //                    default:
    //                        throw 'Internal error: fetch status changed until promise loaded';
    //                }
    //            });
    //        },
    //        
    //        resume: function() {
    //            if (status !== FetchStatus.STOPPED) {
    //                throw 'Cannot resume non-stopped fetch';
    //            }
    //            status = FetchStatus.ACTIVE;
    //            interval = setInterval(calculateSingleStageFetchResult, 500);
    //        }
    //    };
    //};

    return SierpinskiProgressiveFetcher;
})();