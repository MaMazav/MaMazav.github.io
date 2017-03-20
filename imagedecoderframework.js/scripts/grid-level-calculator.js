var GridLevelCalculator = (function GridLevelCalculatorClosure() {
	function GridLevelCalculator(imageParams) {
        this._lowestLevelWidth  = imageParams.tileWidth  * imageParams.lowestLevelTilesX;
        this._lowestLevelHeight = imageParams.tileHeight * imageParams.lowestLevelTilesY;
        this._imageLevel = imageParams.levels - 1;
	}
	
	GridLevelCalculator.prototype.getLevelWidth = function getLevelWidth(level) {
		return this._lowestLevelWidth * Math.pow(2, level);
	};
	
	GridLevelCalculator.prototype.getLevelHeight = function getLevelHeight(level) {
		return this._lowestLevelHeight * Math.pow(2, level);
	};

	GridLevelCalculator.prototype.getLevel = function getDefaultNumResolutionLevels(regionImageLevel) {
		var log2 = Math.log(2);
		var levelX = Math.log(regionImageLevel.screenWidth  / (regionImageLevel.maxXExclusive - regionImageLevel.minX)) / log2;
		var levelY = Math.log(regionImageLevel.screenHeight / (regionImageLevel.maxYExclusive - regionImageLevel.minY)) / log2;
		var level = Math.ceil(Math.min(levelX, levelY));
		level = Math.max(0, Math.min(0, level) + this._imageLevel);
		return level;
	};
	
	return GridLevelCalculator;
})();