var GridDecoderWorkersInputRetreiver = (function GridDecoderWorkersInputRetreiverClosure() {
    var FETCH_WAIT_TASK = 0;
    var DECODE_TASK = 1;

    function GridDecoderWorkersInputRetreiver(imageParams) {
        this.waitingFetches = {};
        this._imageParams = imageParams;
    }
    
    GridDecoderWorkersInputRetreiver.prototype.getPromiseTaskProperties = function(taskKey) {
        if (taskKey.fetchWaitTask) {
            return {
                taskType: FETCH_WAIT_TASK,
                dependsOnTasks: [],
                isDisableWorker: true
            };
        }
        
        var imagePartParams = taskKey;
        var tilesRange = GridImage.getTilesRange(this._imageParams, imagePartParams);
        
        var depends = new Array((tilesRange.maxTileX - tilesRange.minTileX) * (tilesRange.maxTileY - tilesRange.minTileY));
        var i = 0;
        for (var tileX = tilesRange.minTileX; tileX < tilesRange.maxTileX; ++tileX) {
            for (var tileY = tilesRange.minTileY; tileY < tilesRange.maxTileY; ++tileY) {
                depends[i++] = {
                    fetchWaitTask: true,
                    tileX: tileX,
                    tileY: tileY,
                    level: imagePartParams.level
                };
            }
        }
        
        return {
            taskType: DECODE_TASK,
            dependsOnTasks: depends,
            isDisableWorker: false
        };
    };
    
    GridDecoderWorkersInputRetreiver.prototype.preWorkerProcess = function(dependsTaskResults, dependsTaskKeys, taskKey) {
        if (taskKey.fetchWaitTask) {
            var self = this;
            return new Promise(function(resolve, reject) {
                var strKey = self.getKeyAsString(taskKey);
                self.waitingFetches[strKey] = resolve;
            });
        }
        return Promise.resolve({
            tileContents: dependsTaskResults,
            tileIndices: dependsTaskKeys,
            imagePartParams: taskKey,
            tileWidth: this._imageParams.tileWidth,
            tileHeight: this._imageParams.tileHeight
        });
    };
    
    GridDecoderWorkersInputRetreiver.prototype.getTaskTypeOptions = function(taskType) {
        // Works only in the page of ImageDecoderFramework.js/index.html!
        var baseUrl = location.href.substring(0, location.href.lastIndexOf('/')) + '/scripts/';
        var graphicslibraryPath = baseUrl + 'graphics-library.js';
        var gridDecoderPath = baseUrl + 'grid-decoder-worker.js';
        var absolutePaths = [
            graphicslibraryPath,
            gridDecoderPath];

        return {
            scriptsToImport: absolutePaths,
            ctorName: 'GridDecoderWorker',
            ctorArgs: []
        };
    };
    
    GridDecoderWorkersInputRetreiver.prototype.getKeyAsString = function(key) {
        if (key.fetchWaitTask) {
            return 'fetchWait:' + key.tileX + ',' + key.tileY + ':' + key.level;
        }
        // Otherwise it's a imagePartParams key passed by imageDecoderFramework lib. Just create a unique string
        return JSON.stringify(key);
    };
    
    return GridDecoderWorkersInputRetreiver;
})();