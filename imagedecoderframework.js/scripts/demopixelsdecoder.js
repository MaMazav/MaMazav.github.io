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
			
			var tileOffsetInImageY = key.tileY * fetchedData.TILE_HEIGHT - targetImageOffsetY;
			var tileOffsetInImageX = key.tileX * fetchedData.TILE_WIDTH  - targetImageOffsetX;
			var minY = Math.max(0, -tileOffsetInImageY);
			var minX = Math.max(0, -tileOffsetInImageX);
			var maxY = Math.min(fetchedData.TILE_HEIGHT, targetImageData.height - tileOffsetInImageY);
			var maxX = Math.min(fetchedData.TILE_WIDTH , targetImageData.width  - tileOffsetInImageX);
			
			var stride = targetImageData.width * 4;
			var startLineOffset = (tileOffsetInImageX + minX) * 4 + (tileOffsetInImageY + minY) * stride;
			
            for (var i = minY; i < maxY; ++i) {
				//var yInOriginalImage = (key.tileY * fetchedData.TILE_HEIGHT + i) << key.level;
				var offset = startLineOffset;
				startLineOffset += stride;
                for (var j = minX; j < maxX; ++j) {
					/*
					var xInOriginalImage = (key.tileX * fetchedData.TILE_WIDTH + j) << key.level;
					var isBlackSierpinskiPixel = true;
					var yTmp = yInOriginalImage;
					var xTmp = xInOriginalImage;
					while (yTmp > 0 || xTmp > 0) {
						if (yTmp % 3 === 1 && xTmp % 3 === 1) {
							isBlackSierpinskiPixel = false;
							break;
						}
						yTmp /= 3;
						xTmp /= 3;
					}
					if (isBlackSierpinskiPixel) {
						targetImageData.data[offset++] = 0;
						targetImageData.data[offset++] = 0;
						targetImageData.data[offset++] = 0;
						targetImageData.data[offset++] = 255; // Alpha
						continue;
					}
					//*/

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
			
			var largestSierpinskiMaxY = 3;
			var largestSierpinskiMaxX = 3;
			var tileMinY = (key.tileY * fetchedData.TILE_HEIGHT + minY) << key.level;
			var tileMaxY = (key.tileY * fetchedData.TILE_HEIGHT + maxY) << key.level;
			var tileMinX = (key.tileX * fetchedData.TILE_WIDTH  + minX) << key.level;
			var tileMaxX = (key.tileX * fetchedData.TILE_WIDTH  + maxX) << key.level;
			while (tileMaxY > largestSierpinskiMaxY || tileMaxX > largestSierpinskiMaxX) {
				largestSierpinskiMaxY *= 3;
				largestSierpinskiMaxX *= 3;
			}
			paintSierpinski(0, 0, largestSierpinskiMaxX, largestSierpinskiMaxY);
			
			function paintSierpinski(sierpinskiMinX, sierpinskiMinY, sierpinskiMaxX, sierpinskiMaxY) {
				if (sierpinskiMinY > tileMaxY || sierpinskiMaxY < tileMinY || sierpinskiMinX > tileMaxX || sierpinskiMaxX < tileMinX) {
					return;
				}
				var smallSquareHeight = (sierpinskiMaxY - sierpinskiMinY) / 3;
				var smallSquareWidth  = (sierpinskiMaxX - sierpinskiMinX) / 3;
				if (smallSquareHeight <= (1 << key.level)) {
					return;
				}
				
				var ySmallSquares = [sierpinskiMinY, sierpinskiMinY + smallSquareHeight, sierpinskiMaxY - smallSquareHeight, sierpinskiMaxY];
				var xSmallSquares = [sierpinskiMinX, sierpinskiMinX + smallSquareWidth , sierpinskiMaxX - smallSquareWidth , sierpinskiMaxX];
				for (var ySquare = 0; ySquare < 3; ++ySquare) {
					for (var xSquare = 0; xSquare < 3; ++xSquare) {
						if (xSquare !== 1 || ySquare !== 1) {
							paintSierpinski(xSmallSquares[xSquare], ySmallSquares[ySquare], xSmallSquares[xSquare + 1], ySmallSquares[ySquare + 1]);
						}
					}
				}
				
				var centralSquareMinY = Math.max(minY, (ySmallSquares[1] >> key.level) - targetImageOffsetY - tileOffsetInImageY);
				var centralSquareMinX = Math.max(minX, (xSmallSquares[1] >> key.level) - targetImageOffsetX - tileOffsetInImageX);
				var centralSquareMaxY = Math.min(maxY, (ySmallSquares[2] >> key.level) - targetImageOffsetY - tileOffsetInImageY);
				var centralSquareMaxX = Math.min(maxX, (xSmallSquares[2] >> key.level) - targetImageOffsetX - tileOffsetInImageX);
				var startLineOffset = (tileOffsetInImageX + centralSquareMinX) * 4 + (tileOffsetInImageY + centralSquareMinY) * stride;
				
				for (var i = centralSquareMinY; i < centralSquareMaxY; ++i) {
					var offset = startLineOffset;
					startLineOffset += stride;
					for (var j = centralSquareMinX; j < centralSquareMaxX; ++j) {
						targetImageData.data[offset++] = 0;
						targetImageData.data[offset++] = 0;
						targetImageData.data[offset++] = 0;
						targetImageData.data[offset++] = 255; // Alpha
					}
				}
			}
            
            resolve();
        });
    };
    
    return DemoPixelsDecoder;
})();