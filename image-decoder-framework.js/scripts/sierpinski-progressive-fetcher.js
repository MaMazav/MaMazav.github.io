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

    return SierpinskiProgressiveFetcher;
})();