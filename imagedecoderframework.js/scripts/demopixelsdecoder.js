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
            
            // Gradient
            
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
            
            // Sierpinski carpet
            
            var coords = fetchedData.sierpinskiSquaresCoordinates;
            for (var i = 0; i < coords.length; i += 4) {
                var squareMinX = coords[i    ];
                var squareMinY = coords[i + 1];
                var squareMaxX = coords[i + 2];
                var squareMaxY = coords[i + 3];
                // Move sierpinski square coordinates to pixel position in tile
                var squareInTileMinX = Math.max(minX, Math.floor(squareMinX) - targetImageOffsetX - tileOffsetInImageX);
                var squareInTileMinY = Math.max(minY, Math.floor(squareMinY) - targetImageOffsetY - tileOffsetInImageY);
                var squareInTileMaxX = Math.min(maxX, Math.floor(squareMaxX) - targetImageOffsetX - tileOffsetInImageX);
                var squareInTileMaxY = Math.min(maxY, Math.floor(squareMaxY) - targetImageOffsetY - tileOffsetInImageY);
                var startLineOffset = (tileOffsetInImageX + squareInTileMinX) * 4 + (tileOffsetInImageY + squareInTileMinY) * stride;
                
                for (var y = squareInTileMinY; y < squareInTileMaxY; ++y) {
                    var offset = startLineOffset;
                    startLineOffset += stride;
                    for (var x = squareInTileMinX; x < squareInTileMaxX; ++x) {
                        targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                        targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                        targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                        targetImageData.data[offset++] = 255; // Alpha
                    }
                }
                
                // Smiley
                
                var circleRadius = Math.min(squareMaxX - squareMinX, squareMaxY - squareMinY) / 2 - 8;
                if (circleRadius < 10) {
                    continue;
                }
                
                var centerX = Math.floor((squareMinX + squareMaxX) / 2 - targetImageOffsetX - tileOffsetInImageX);
                var centerY = Math.floor((squareMinY + squareMaxY) / 2 - targetImageOffsetY - tileOffsetInImageY);
                var thickness = 5;
                for (var t = 0; t < thickness; ++t) {
                    var circleRadiusForThickness = circleRadius - t;
                    var circleRadiusSquare = circleRadiusForThickness * circleRadiusForThickness;
                    var circleInTileMinX = Math.max(minX, centerX - circleRadiusForThickness);
                    var circleInTileMaxX = Math.min(maxX, centerX + circleRadiusForThickness);
                    var minTheta = Math.asin((circleInTileMinX - centerX) / circleRadiusForThickness);
                    var maxTheta = Math.asin((circleInTileMaxX - centerX) / circleRadiusForThickness);
                    var thetaDiff = 1 / (2 * circleRadiusForThickness);
                    for (var theta = minTheta; theta < maxTheta; theta += thetaDiff) {
                        var x     = Math.floor(circleRadiusForThickness * Math.sin(theta) + centerX);
                        var yDiff = circleRadiusForThickness * Math.cos(theta);;
                        var yUp   = Math.floor(centerY + yDiff);
                        var yDown = Math.floor(centerY - yDiff);
                        //
                        //var y = Math.floor(Math.sqrt(circleRadiusSquare - (x - centerX) * (x - centerX)));
                        //var yUp   = centerY - y;
                        //var yDown = centerY + y;
                        if (yUp > minY && yUp < maxY) {
                            var offset = (tileOffsetInImageX + x) * 4 + (tileOffsetInImageY + yUp) * stride;
                            targetImageData.data[offset++] = 255;
                            targetImageData.data[offset++] = 255;
                            targetImageData.data[offset++] = 255;
                            targetImageData.data[offset++] = 255;
                        }
                        if (yDown > minY && yDown < maxY) {
                            var offset = (tileOffsetInImageX + x) * 4 + (tileOffsetInImageY + yDown) * stride;
                            targetImageData.data[offset++] = 255;
                            targetImageData.data[offset++] = 255;
                            targetImageData.data[offset++] = 255;
                            targetImageData.data[offset++] = 255;
                        }
                    }
                }
            }
            
            resolve();
        });
    };
    
    return DemoPixelsDecoder;
})();