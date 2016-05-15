var GridImageParamsRetriever = (function GridImageParamsRetrieverClosure() {
	function GridImageParamsRetriever(imageParams) {
        this._lowestLevelWidth  = imageParams.internalTileWidth  * imageParams.lowestLevelTilesX;
        this._lowestLevelHeight = imageParams.internalTileHeight * imageParams.lowestLevelTilesY;
        this._imageLevel = imageParams.levels - 1;
	}
	
	GridImageParamsRetriever.prototype.getLevelWidth = function getLevelWidth(level) {
		return this._lowestLevelWidth * Math.pow(2, level);
	};
	
	GridImageParamsRetriever.prototype.getLevelHeight = function getLevelHeight(level) {
		return this._lowestLevelHeight * Math.pow(2, level);
	};

	GridImageParamsRetriever.prototype.getImageLevel = function getImageLevel() {
		return this._imageLevel;
	};
	
	GridImageParamsRetriever.prototype.getLevel = function getDefaultNumResolutionLevels(regionImageLevel) {
		var log2 = Math.log(2);
		var levelX = Math.log(regionImageLevel.screenWidth  / (regionImageLevel.maxXExclusive - regionImageLevel.minX)) / log2;
		var levelY = Math.log(regionImageLevel.screenHeight / (regionImageLevel.maxYExclusive - regionImageLevel.minY)) / log2;
		var level = Math.ceil(Math.min(levelX, levelY));
		level = Math.max(0, Math.min(0, level) + this._imageLevel);
		return level;
	};
	
	GridImageParamsRetriever.prototype.getNumResolutionLevelsForLimittedViewer = function getNumResolutionLevelsForLimittedViewer() {
		return this._imageLevel + 1;
	};
	
	GridImageParamsRetriever.prototype.getLowestQuality = function getLowestQuality() {
		return 'arbitrary value';
	};
	
	GridImageParamsRetriever.prototype.getHighestQuality = function getHighestQuality() {
		return 'Another arbitrary value';
	};
	
	return GridImageParamsRetriever;
})();