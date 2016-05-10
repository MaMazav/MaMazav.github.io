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
            
            var coords = fetchedData.sierpinskiSquaresCoordinates;
            for (var i = 0; i < coords.length; i += 4) {
                // Move sierpinski square coordinates to pixel position in tile
                var squareMinX = Math.max(minX, Math.floor(coords[i    ]) - targetImageOffsetX - tileOffsetInImageX);
                var squareMinY = Math.max(minY, Math.floor(coords[i + 1]) - targetImageOffsetY - tileOffsetInImageY);
                var squareMaxX = Math.min(maxX, Math.floor(coords[i + 2]) - targetImageOffsetX - tileOffsetInImageX);
                var squareMaxY = Math.min(maxY, Math.floor(coords[i + 3]) - targetImageOffsetY - tileOffsetInImageY);
                var startLineOffset = (tileOffsetInImageX + squareMinX) * 4 + (tileOffsetInImageY + squareMinY) * stride;
                
                for (var y = squareMinY; y < squareMaxY; ++y) {
                    var offset = startLineOffset;
                    startLineOffset += stride;
                    for (var x = squareMinX; x < squareMaxX; ++x) {
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