'use strict';

var DemoPixelsDecoder = (function DemoPixelsDecoderClosure() {
    function DemoPixelsDecoder() {
		imageDecoderFramework.SimplePixelsDecoderBase.call(this);
    }
	
	DemoPixelsDecoder.prototype = Object.create(imageDecoderFramework.SimplePixelsDecoderBase.prototype);
    
    DemoPixelsDecoder.prototype.decodeRegion = function decodeRegion(targetImageData, targetImageOffsetX, targetImageOffsetY, key, fetchedData) {
        return new Promise(function(resolve, reject) {
			var crScale = (fetchedData.maxCr - fetchedData.minCr) / fetchedData.TILE_HEIGHT;
			var cbScale = (fetchedData.maxCb - fetchedData.minCb) / fetchedData.TILE_WIDTH;
			
			var targetOffsetY = key.tileY * fetchedData.TILE_HEIGHT - targetImageOffsetY;
			var targetOffsetX = key.tileX * fetchedData.TILE_WIDTH  - targetImageOffsetX;
			var minY = Math.max(0, -targetOffsetY);
			var minX = Math.max(0, -targetOffsetX);
			var maxY = Math.min(fetchedData.TILE_HEIGHT, targetImageData.height - targetOffsetY);
			var maxX = Math.min(fetchedData.TILE_WIDTH , targetImageData.width  - targetOffsetX);
			
			var stride = targetImageData.width * 4;
			var startLineOffset = (targetOffsetX + minX) * 4 + (targetOffsetY + minY) * stride;
			console.log(key.tileX + ',' + key.tileY + ': ' + fetchedData.minCb + ',' + fetchedData.minCr + ' -> ' + fetchedData.maxCb + ',' + fetchedData.maxCr +
				'. offset ' + targetImageOffsetX + ', ' + targetImageOffsetY + '. startLineOffset=' + startLineOffset + '. X:' + minX + '->' + maxX + '. Y:' + minY + '->' + maxY);
			
            for (var i = minY; i < maxY; ++i) {
				var offset = startLineOffset;
				startLineOffset += stride;
                for (var j = minX; j < maxX; ++j) {
                    // Some demonstration calculation
                    var intensity = 230;
                    var cr = crScale * i + fetchedData.minCr;
                    var cb = cbScale * j + fetchedData.minCb;
                    var r = intensity + 1.402 * (cr - 128);
                    var g = intensity - 0.34414 * (cb - 128) - 0.1414 * (cr - 128);
                    var b = intensity + 1.772 * (cb - 128);
                    
                    targetImageData.data[offset++] = r; // Red
                    targetImageData.data[offset++] = g; // Green
                    targetImageData.data[offset++] = b; // Blue
                    targetImageData.data[offset++] = 255; // Alpha
                }
            }
            
            resolve();
        });
    };
    
    return DemoPixelsDecoder;
})();