var DemoImageParamsRetriever = (function DemoImageParamsRetrieverClosure() {
	function DemoImageParamsRetriever(imageParams) {
		this._imageParams = imageParams;
	}
	
	DemoImageParamsRetriever.prototype.getLevelWidth = function getLevelWidth(level) {
		return this._imageParams.lowestLevelWidth * Math.pow(2, level);
	};
	
	DemoImageParamsRetriever.prototype.getLevelHeight = function getLevelHeight(level) {
		return this._imageParams.lowestLevelHeight * Math.pow(2, level);
	};

	DemoImageParamsRetriever.prototype.getImageLevel = function getImageLevel() {
		return this._imageParams.imageLevel;
	};
	
	DemoImageParamsRetriever.prototype.getLevel = function getDefaultNumResolutionLevels(regionImageLevel) {
		var log2 = Math.log(2);
		var levelX = Math.log(regionImageLevel.screenWidth  / (regionImageLevel.maxXExclusive - regionImageLevel.minX)) / log2;
		var levelY = Math.log(regionImageLevel.screenHeight / (regionImageLevel.maxYExclusive - regionImageLevel.minY)) / log2;
		var level = Math.ceil(Math.min(levelX, levelY));
		level = Math.max(0, level + this._imageParams.imageLevel);
		return level;
	};
	
	DemoImageParamsRetriever.prototype.getNumResolutionLevelsForLimittedViewer = function getNumResolutionLevelsForLimittedViewer() {
		return this._imageParams.imageLevel + 1;
	};
	
	DemoImageParamsRetriever.prototype.getLowestQuality = function getLowestQuality() {
		return 'arbitrary value';
	};
	
	DemoImageParamsRetriever.prototype.getHighestQuality = function getHighestQuality() {
		return 'Another arbitrary value';
	};
	
	return DemoImageParamsRetriever;
})();