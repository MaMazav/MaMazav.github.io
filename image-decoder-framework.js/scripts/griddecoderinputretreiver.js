var GridDecoderInputRetriever = (function GridDecoderInputRetrieverClosure() {
    function GridDecoderInputRetriever(imageParams) {
        this._imageParams = imageParams;
    }
    
    GridDecoderInputRetriever.prototype.getDependsOnTasks = function (taskKey) {
        return [];
    };
    
    GridDecoderInputRetriever.prototype.preWorkerProcess: function (dependsTaskResults, dependsTaskKeys, taskKey) {
        return Promise.resolve();
    };
    
    GridDecoderInputRetriever.prototype.getHashCode = function getHashCode(key) {
        return key.minX ^ key.minY ^ key.maxXExclusive ^ key.maxYExclusive ^ key.level;
    };

    GridDecoderInputRetriever.prototype.isEqual = function isEqual(key1, key2) {
        return
            key1.minX === key2.minX &&
            key1.minY === key2.minY &&
            key1.maxYExclusive === key2.maxYExclusive &&
            key1.maxXExclusive === key2.maxXExclusive &&
            key1.level === key2.level;
    };

	return GridDecoderInputRetriever;
})();