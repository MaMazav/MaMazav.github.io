var graphicsLibrary = {
    createSierpinskiSquaresCollector: function createSierpinskiSquaresCollector(
		regionMinX, regionMinY, regionMaxX, regionMaxY, carpetSize) {
		
		var collectedSquares = [];
		var nextStageStartRegions = [0, 0, carpetSize, carpetSize];
		
		var result = {
			getCollectedSquaresCoordinates: function getCollectedSquares() {
				return collectedSquares;
			},
			
			collect: function collect(minSquareSize) {
				var startRegion = nextStageStartRegions;
				nextStageStartRegions = [];
				for (var i = 0; i < startRegion.length; i += 4) {
					collectSierpinskiSquaresRecursively(
						regionMinX, regionMinY, regionMaxX, regionMaxY,
						startRegion[i], startRegion[i + 1], startRegion[i + 2], startRegion[i + 3],
						minSquareSize || 2, minSquareSize || 2);
				}
			}
		};

        function collectSierpinskiSquaresRecursively(
            regionMinX, regionMinY, regionMaxX, regionMaxY,
            carpetMinX, carpetMinY, carpetMaxX, carpetMaxY,
            minSquareWidth, minSquareHeight) {
                
            if (carpetMinY > regionMaxY || carpetMaxY < regionMinY || carpetMinX > regionMaxX || carpetMaxX < regionMinX) {
                return;
            }
            var smallSquareHeight = (carpetMaxY - carpetMinY) / 3;
            var smallSquareWidth  = (carpetMaxX - carpetMinX) / 3;
            if (smallSquareHeight < minSquareHeight || smallSquareWidth < minSquareWidth) {
				nextStageStartRegions.push(carpetMinX);
				nextStageStartRegions.push(carpetMinY);
				nextStageStartRegions.push(carpetMaxX);
				nextStageStartRegions.push(carpetMaxY);
                return;
            }
            
            var ySmallSquares = [carpetMinY, carpetMinY + smallSquareHeight, carpetMaxY - smallSquareHeight, carpetMaxY];
            var xSmallSquares = [carpetMinX, carpetMinX + smallSquareWidth , carpetMaxX - smallSquareWidth , carpetMaxX];
            for (var ySquare = 0; ySquare < 3; ++ySquare) {
                for (var xSquare = 0; xSquare < 3; ++xSquare) {
                    if (xSquare !== 1 || ySquare !== 1) {
                        collectSierpinskiSquaresRecursively(
                            regionMinX, regionMinY, regionMaxX, regionMaxY,
                            xSmallSquares[xSquare], ySmallSquares[ySquare], xSmallSquares[xSquare + 1], ySmallSquares[ySquare + 1],
                            minSquareWidth, minSquareHeight);
                    }
                }
            }
            
            collectedSquares.push(xSmallSquares[1]);
            collectedSquares.push(ySmallSquares[1]);
            collectedSquares.push(xSmallSquares[2]);
            collectedSquares.push(ySmallSquares[2]);
        }
        
        return result;
    },
    
    paintIntersectedCircle: function(targetImageData, radius, centerX, centerY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness) {
        thickness = thickness || 1;
        var stride = targetImageData.width * 4;
        for (var t = 0; t < thickness; ++t) {
            var circleRadiusForThickness = radius + t;
            var circleRadiusSquare = circleRadiusForThickness * circleRadiusForThickness;
            var minXInCircle = Math.max(intersectMinX - centerX, -circleRadiusForThickness);
            var maxXInCircle = Math.min(intersectMaxX - centerX,  circleRadiusForThickness);
            var minTheta = Math.asin(minXInCircle / circleRadiusForThickness);
            var maxTheta = Math.asin(maxXInCircle / circleRadiusForThickness);
            var thetaDiff = 1 / (2 * circleRadiusForThickness);
            for (var theta = minTheta; theta < maxTheta; theta += thetaDiff) {
                var x     = Math.floor(circleRadiusForThickness * Math.sin(theta) + centerX);
                var yDiff = circleRadiusForThickness * Math.cos(theta);;
                var yUp   = Math.floor(centerY + yDiff);
                var yDown = Math.floor(centerY - yDiff);
                
                if (yUp > intersectMinY && yUp < intersectMaxY) {
                    var offset = x * 4 + yUp * stride;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                }
                if (yDown > intersectMinY && yDown < intersectMaxY) {
                    var offset = x * 4 + yDown * stride;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                }
            }
        }
    },
    
    fillGradient: function(targetImageData, minX, minY, maxX, maxY, minCb, minCr, maxCb, maxCr) {
        var stride = targetImageData.width * 4;
        var startLineOffset = minX * 4 + minY * stride;
        var crScale = (maxCr - minCr) / (maxY - minY);
        var cbScale = (maxCb - minCb) / (maxX - minX);

        for (var i = 0; i < maxY - minY; ++i) {
            var offset = startLineOffset;
            startLineOffset += stride;
            for (var j = 0; j < maxX - minX; ++j) {
                // Some demonstration calculation
                var intensity = 230;
                var cr = crScale * i + minCr;
                var cb = cbScale * j + minCb;
                var r = intensity + 1.402 * (cr - 128);
                var g = intensity - 0.34414 * (cb - 128) - 0.1414 * (cr - 128);
                var b = intensity + 1.772 * (cb - 128);
                
                targetImageData.data[offset++] = r; // Red
                targetImageData.data[offset++] = g; // Green
                targetImageData.data[offset++] = b; // Blue
                targetImageData.data[offset++] = 255; // Alpha
            }
        }
    },
    
    inverseColors: function(targetImageData, minX, minY, maxX, maxY) {
        var stride = targetImageData.width * 4;
        var startLineOffset = minX * 4 + minY * stride;
        
        for (var y = minY; y < maxY; ++y) {
            var offset = startLineOffset;
            startLineOffset += stride;
            for (var x = minX; x < maxX; ++x) {
                targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                targetImageData.data[offset++] = 255; // Alpha
            }
        }
    },
	
	paintIntersectedSmiley: function(targetImageData, radius, centerX, centerY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness) {
		graphicsLibrary.paintIntersectedCircle(
			targetImageData, radius, centerX, centerY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness);
		
		var eyeRadius = radius / 10;
		var eyeY = centerY - radius * 0.5;
		var  leftEyeX = centerX - radius * 0.5;
		var rightEyeX = centerX + radius * 0.5;
		graphicsLibrary.paintIntersectedCircle(
			targetImageData, eyeRadius,  leftEyeX, eyeY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness);
		graphicsLibrary.paintIntersectedCircle(
			targetImageData, eyeRadius, rightEyeX, eyeY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness);
		
		var mouthY = centerY + radius * 0.5;
		var mouthRadius = radius / 5;
		graphicsLibrary.paintIntersectedCircle(
			targetImageData, mouthRadius, centerX, mouthY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness);

	}
};