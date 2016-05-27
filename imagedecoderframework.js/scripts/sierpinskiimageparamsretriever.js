var SierpinskiImageParamsRetriever = (function SierpinskiImageParamsRetrieverClosure() {
	function SierpinskiImageParamsRetriever(imageParams) {
        this._lowestLevelWidth  = imageParams.internalTileWidth  * imageParams.lowestLevelTilesX;
        this._lowestLevelHeight = imageParams.internalTileHeight * imageParams.lowestLevelTilesY;
        this._imageLevel = imageParams.imageLevel;
	}
	
	SierpinskiImageParamsRetriever.LOWEST_QUALITY_SIERPINSKI_SQUARE_SIZE = 81;
	SierpinskiImageParamsRetriever.HIGHEST_QUALITY_SIERPINSKI_SQUARE_SIZE = 4;
	
	SierpinskiImageParamsRetriever.prototype.getLevelWidth = function getLevelWidth(level) {
		return this._lowestLevelWidth * Math.pow(2, level);
	};
	
	SierpinskiImageParamsRetriever.prototype.getLevelHeight = function getLevelHeight(level) {
		return this._lowestLevelHeight * Math.pow(2, level);
	};

	SierpinskiImageParamsRetriever.prototype.getImageLevel = function getImageLevel() {
		return this._imageLevel;
	};
	
	SierpinskiImageParamsRetriever.prototype.getLevel = function getDefaultNumResolutionLevels(regionImageLevel) {
		var log2 = Math.log(2);
		var levelX = Math.log(regionImageLevel.screenWidth  / (regionImageLevel.maxXExclusive - regionImageLevel.minX)) / log2;
		var levelY = Math.log(regionImageLevel.screenHeight / (regionImageLevel.maxYExclusive - regionImageLevel.minY)) / log2;
		var level = Math.ceil(Math.min(levelX, levelY));
		level = Math.max(0, level + this._imageLevel);
		return level;
	};
	
	SierpinskiImageParamsRetriever.prototype.getNumResolutionLevelsForLimittedViewer = function getNumResolutionLevelsForLimittedViewer() {
		return this._imageLevel + 1;
	};
	
	SierpinskiImageParamsRetriever.prototype.getLowestQuality = function getLowestQuality() {
		return SierpinskiImageParamsRetriever.LOWEST_QUALITY_SIERPINSKI_SQUARE_SIZE;
	};
	
	SierpinskiImageParamsRetriever.prototype.getHighestQuality = function getHighestQuality() {
		return SierpinskiImageParamsRetriever.HIGHEST_QUALITY_SIERPINSKI_SQUARE_SIZE;
	};
	
	return SierpinskiImageParamsRetriever;
})();