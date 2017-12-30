'use strict';

var LimittedGridLevelCalculator = (function LimittedGridLevelCalculatorClosure() {
    function LimittedGridLevelCalculator(imageParams, minLevel, maxLevel) {
        imageDecoderFramework.GridLevelCalculator.call(this, imageParams);
        this._imageParams = imageParams;
        this._minLevel = minLevel;
        this._maxLevel = maxLevel;
    }
    
    LimittedGridLevelCalculator.prototype = Object.create(imageDecoderFramework.GridLevelCalculator.prototype);
    
    LimittedGridLevelCalculator.prototype.getLevel = function getLevel(regionImageLevel) {
        // Perform calculation of level according to resolution, as implemented in base class
        var level = imageDecoderFramework.GridLevelCalculator.prototype.getLevel.call(this, regionImageLevel);
        
        // Limit level to the predefined range
        var limittedLevel = Math.max(this._minLevel, Math.min(this._maxLevel, level));
        
        return limittedLevel;
    };
    
    return LimittedGridLevelCalculator;
})();