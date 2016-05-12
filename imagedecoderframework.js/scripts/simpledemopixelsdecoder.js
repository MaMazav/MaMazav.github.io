'use strict';

var SimpleDemoPixelsDecoder = (function DemoPixelsDecoderClosure() {
	var BORDER_THICKNESS = 5;
	
    function SimpleDemoPixelsDecoder() {
        imageDecoderFramework.SimplePixelsDecoderBase.call(this);
    }
    
    SimpleDemoPixelsDecoder.prototype = Object.create(imageDecoderFramework.SimplePixelsDecoderBase.prototype);
    
    SimpleDemoPixelsDecoder.prototype.decodeRegion = function decodeRegion(targetImageData, targetImageOffsetX, targetImageOffsetY, key, fetchedData) {
        return new Promise(function(resolve, reject) {
            var minY = Math.max(key.tileY * fetchedData.TILE_HEIGHT - targetImageOffsetY, 0);
            var minX = Math.max(key.tileX * fetchedData.TILE_WIDTH  - targetImageOffsetX, 0);
            var maxY = Math.min(key.tileY * fetchedData.TILE_HEIGHT - targetImageOffsetY + fetchedData.TILE_HEIGHT, targetImageData.height);
            var maxX = Math.min(key.tileX * fetchedData.TILE_WIDTH  - targetImageOffsetX + fetchedData.TILE_WIDTH , targetImageData.width);
            
            // Fill all area with red color
            
            var stride = targetImageData.width * 4;
			for (var y = minY; y < maxY; ++y) {
				var yOriginalImage = targetImageOffsetY + y;
				var offset = minX * 4 + stride * y;
				for (var x = minX; x < maxX; ++x) {
					var xOriginalImage = targetImageOffsetX + x;
					
					var isTileBorder = yOriginalImage % fetchedData.TILE_HEIGHT < BORDER_THICKNESS || xOriginalImage % fetchedData.TILE_WIDTH < BORDER_THICKNESS;
					targetImageData.data[offset++] = 0; // Red
					targetImageData.data[offset++] = isTileBorder ? 255 : 0; // Green
					targetImageData.data[offset++] = 255; // Blue
					targetImageData.data[offset++] = 255; // Alpha
				}
			}
            
            resolve();
        });
    };
    
    return SimpleDemoPixelsDecoder;
})();