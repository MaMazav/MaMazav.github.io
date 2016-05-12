'use strict';

var DemoPixelsDecoder = (function DemoPixelsDecoderClosure() {
    function DemoPixelsDecoder() {
        imageDecoderFramework.SimplePixelsDecoderBase.call(this);
    }
    
    DemoPixelsDecoder.prototype = Object.create(imageDecoderFramework.SimplePixelsDecoderBase.prototype);
    
    DemoPixelsDecoder.prototype.decodeRegion = function decodeRegion(targetImageData, targetImageOffsetX, targetImageOffsetY, key, fetchedData) {
        return new Promise(function(resolve, reject) {
            var minY = Math.max(key.tileY * fetchedData.TILE_HEIGHT - targetImageOffsetY, 0);
            var minX = Math.max(key.tileX * fetchedData.TILE_WIDTH  - targetImageOffsetX, 0);
            var maxY = Math.min(key.tileY * fetchedData.TILE_HEIGHT - targetImageOffsetY + fetchedData.TILE_HEIGHT, targetImageData.height);
            var maxX = Math.min(key.tileX * fetchedData.TILE_WIDTH  - targetImageOffsetX + fetchedData.TILE_WIDTH , targetImageData.width);
            
            var stride = targetImageData.width * 4;
            
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
                var squareInTileMinX = Math.max(minX, Math.floor(squareMinX) - targetImageOffsetX);
                var squareInTileMinY = Math.max(minY, Math.floor(squareMinY) - targetImageOffsetY);
                var squareInTileMaxX = Math.min(maxX, Math.floor(squareMaxX) - targetImageOffsetX);
                var squareInTileMaxY = Math.min(maxY, Math.floor(squareMaxY) - targetImageOffsetY);
                graphicsLibrary.inverseColors(targetImageData, squareInTileMinX, squareInTileMinY, squareInTileMaxX, squareInTileMaxY)
                
                // Smiley
                
                var circleRadius = Math.min(squareMaxX - squareMinX, squareMaxY - squareMinY) / 2 - 8;
                if (circleRadius < 20) {
                    continue;
                }
                
                var centerX = Math.floor((squareMinX + squareMaxX) / 2 - targetImageOffsetX);
                var centerY = Math.floor((squareMinY + squareMaxY) / 2 - targetImageOffsetY);
                graphicsLibrary.paintIntersectedCircle(
                    targetImageData, circleRadius, centerX, centerY, squareInTileMinX, squareInTileMinY, squareInTileMaxX, squareInTileMaxY, /*thickness=*/5);
                
                var eyeRadius = circleRadius / 10;
                var eyeY = centerY - circleRadius * 0.5;
                var  leftEyeX = centerX - circleRadius * 0.5;
                var rightEyeX = centerX + circleRadius * 0.5;
                graphicsLibrary.paintIntersectedCircle(
                    targetImageData, eyeRadius,  leftEyeX, eyeY, squareInTileMinX, squareInTileMinY, squareInTileMaxX, squareInTileMaxY, /*thickness=*/5);
                graphicsLibrary.paintIntersectedCircle(
                    targetImageData, eyeRadius, rightEyeX, eyeY, squareInTileMinX, squareInTileMinY, squareInTileMaxX, squareInTileMaxY, /*thickness=*/5);
                
                var mouthY = centerY + circleRadius * 0.5;
                var mouthRadius = circleRadius / 5;
                graphicsLibrary.paintIntersectedCircle(
                    targetImageData, mouthRadius, centerX, mouthY, squareInTileMinX, squareInTileMinY, squareInTileMaxX, squareInTileMaxY, /*thickness=*/5);
            }
            
            resolve();
        });
    };
    
    return DemoPixelsDecoder;
})();