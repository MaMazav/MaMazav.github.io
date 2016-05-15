'use strict';

var SierpinskiPixelsDecoder = (function SierpinskiPixelsDecoderClosure() {
    function SierpinskiPixelsDecoder() {
        imageDecoderFramework.SimplePixelsDecoderBase.call(this);
    }
    
    SierpinskiPixelsDecoder.prototype = Object.create(imageDecoderFramework.SimplePixelsDecoderBase.prototype);
    
    SierpinskiPixelsDecoder.prototype.decodeRegion = function decodeRegion(targetImageData, targetImageOffsetX, targetImageOffsetY, key, fetchedData) {
        return new Promise(function(resolve, reject) {
            var minY = Math.max(key.tileY * fetchedData.TILE_HEIGHT - targetImageOffsetY, 0);
            var minX = Math.max(key.tileX * fetchedData.TILE_WIDTH  - targetImageOffsetX, 0);
            var maxY = Math.min(key.tileY * fetchedData.TILE_HEIGHT - targetImageOffsetY + fetchedData.TILE_HEIGHT, targetImageData.height);
            var maxX = Math.min(key.tileX * fetchedData.TILE_WIDTH  - targetImageOffsetX + fetchedData.TILE_WIDTH , targetImageData.width);
            
            // Gradient
            
            var minCr = (minY + targetImageOffsetY) * 256 / fetchedData.LEVEL_HEIGHT;
            var minCb = (minX + targetImageOffsetX) * 256 / fetchedData.LEVEL_WIDTH;
            var maxCr = (maxY + targetImageOffsetY) * 256 / fetchedData.LEVEL_HEIGHT;
            var maxCb = (maxX + targetImageOffsetX) * 256 / fetchedData.LEVEL_WIDTH;
            graphicsLibrary.fillGradient(targetImageData, minX, minY, maxX, maxY, minCb, minCr, maxCb, maxCr);
            
            // Sierpinski carpet
            
            var coords = fetchedData.sierpinskiSquaresCoordinates;
            for (var i = 0; i < coords.length; i += 4) {
                var squareMinX = coords[i    ];
                var squareMinY = coords[i + 1];
                var squareMaxX = coords[i + 2];
                var squareMaxY = coords[i + 3];
                // Move sierpinski square coordinates to pixel position in tile
                var intersectMinX = Math.max(minX, Math.floor(squareMinX) - targetImageOffsetX);
                var intersectMinY = Math.max(minY, Math.floor(squareMinY) - targetImageOffsetY);
                var intersectMaxX = Math.min(maxX, Math.floor(squareMaxX) - targetImageOffsetX);
                var intersectMaxY = Math.min(maxY, Math.floor(squareMaxY) - targetImageOffsetY);
                graphicsLibrary.inverseColors(targetImageData, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY)
                
                // Smiley
                
                var smileyRadius = Math.min(squareMaxX - squareMinX, squareMaxY - squareMinY) / 2 - 8;
                if (smileyRadius > 20) {
					var centerX = Math.floor((squareMinX + squareMaxX) / 2 - targetImageOffsetX);
					var centerY = Math.floor((squareMinY + squareMaxY) / 2 - targetImageOffsetY);
					graphicsLibrary.paintIntersectedSmiley(targetImageData, smileyRadius, centerX, centerY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, /*thickness=*/5)
					
                }
            }
            
            resolve();
        });
    };
    
    return SierpinskiPixelsDecoder;
})();