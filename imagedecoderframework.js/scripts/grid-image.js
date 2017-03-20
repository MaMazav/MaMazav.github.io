var GridImage = (function GridImage() {
    function GridImage() {
        var fetcher = new GridFetcher();
		var promiseFetcher = new imageDecoderFramework.PromiseFetcherAdapter(fetcher);
        this._fetchManager = new imageDecoderFramework.FetchManager(promiseFetcher);
        this._levelCalculator = null;
        this._decoderWorkers = null;
    }
    
    GridImage.prototype.getFetchManager = function getFetchManager() {
        return this._fetchManager;
    };
    
    GridImage.prototype.getLevelCalculator = function getLevelCalculator(imageParams) {
        if (this._levelCalculator === null) {
            var imageParams = this._fetchManager.getImageParams();
            this._levelCalculator = new GridLevelCalculator(imageParams);
        }
        return this._levelCalculator;
    };
    
    GridImage.prototype.getDecoderWorkers = function getDecoderWorkers() {
        if (this._decoderWorkers === null) {
            var imageParams = this._fetchManager.getImageParams(); // imageParams that returned by fetcher.open()
            this._inputRetreiver = new GridDecoderWorkersInputRetreiver(imageParams);
            this._decoderWorkers = new AsyncProxy.PromiseDependencyWorkers(this._inputRetreiver);
            this._fetchManager.on('data', this._onDataFetched.bind(this));
        }
        return this._decoderWorkers;
    };
    
    GridImage.prototype._onDataFetched = function(fetchedTiles, imagePartParams) {
        for (var i = 0; i < fetchedTiles.length; ++i) {
            var strKey = this._inputRetreiver.getKeyAsString(fetchedTiles[i].tileKey);
            var waitingPromise = this._inputRetreiver.waitingFetches[strKey];
            if (waitingPromise) {
                delete this._inputRetreiver.waitingFetches[strKey];
                waitingPromise(fetchedTiles[i].content);
            }
        }
    };
    
    GridImage.getTilesRange = function(imageParams, imagePartParams) {
        var levelTilesX = imageParams.lowestLevelTilesX << imagePartParams.level;
        var levelTilesY = imageParams.lowestLevelTilesY << imagePartParams.level;
        return {
            minTileX: Math.max(0, Math.floor(imagePartParams.minX / imageParams.tileWidth )),
            minTileY: Math.max(0, Math.floor(imagePartParams.minY / imageParams.tileHeight)),
            maxTileX: Math.min(levelTilesX, Math.ceil(imagePartParams.maxXExclusive / imageParams.tileWidth )),
            maxTileY: Math.min(levelTilesY, Math.ceil(imagePartParams.maxYExclusive / imageParams.tileHeight))
        };
    };

    return GridImage;
})();
