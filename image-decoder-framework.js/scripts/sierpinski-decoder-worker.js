'use strict';

var SierpinskiDecoderWorker = (function SierpinskiDecoderWorkerClosure() {
    function SierpinskiDecoderWorker() {
        imageDecoderFramework.GridDecoderWorkerBase.call(this);
    }
    
    SierpinskiDecoderWorker.prototype = Object.create(imageDecoderFramework.GridDecoderWorkerBase.prototype);
    
    SierpinskiDecoderWorker.prototype.decodeRegion = function decodeRegion(targetImageData, offset, regionInImage, tile) {
        return new Promise(function(resolve, reject) {
            var minX = Math.max(tile.position.minX          - offset.x, 0);
            var minY = Math.max(tile.position.minY          - offset.y, 0);
            var maxX = Math.min(tile.position.maxXExclusive - offset.x, targetImageData.width);
            var maxY = Math.min(tile.position.maxYExclusive - offset.y, targetImageData.height);
            
            // Gradient
            
            var minCb = regionInImage.minX          * 256 / tile.content.levelWidth ;
            var minCr = regionInImage.minY          * 256 / tile.content.levelHeight;
            var maxCb = regionInImage.maxXExclusive * 256 / tile.content.levelWidth ;
            var maxCr = regionInImage.maxYExclusive * 256 / tile.content.levelHeight;
            graphicsLibrary.fillGradient(
                targetImageData,
                offset.x, offset.y, offset.x + regionInImage.width, offset.y + regionInImage.height,
                minCb, minCr, maxCb, maxCr);
            
            // Sierpinski carpet
            
            var coords = tile.content.sierpinskiSquaresCoordinates;
            for (var i = 0; i < coords.length; i += 4) {
                var squareMinX = coords[i    ];
                var squareMinY = coords[i + 1];
                var squareMaxX = coords[i + 2];
                var squareMaxY = coords[i + 3];
                // Move sierpinski square coordinates to pixel position in tile
                var intersectMinX = Math.max(regionInImage.minX         , Math.floor(squareMinX)) + offset.x - regionInImage.minX;
                var intersectMinY = Math.max(regionInImage.minY         , Math.floor(squareMinY)) + offset.y - regionInImage.minY;
                var intersectMaxX = Math.min(regionInImage.maxXExclusive, Math.floor(squareMaxX)) + offset.x - regionInImage.minX;
                var intersectMaxY = Math.min(regionInImage.maxYExclusive, Math.floor(squareMaxY)) + offset.y - regionInImage.minY;
                graphicsLibrary.inverseColors(targetImageData, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY)
                
                // Smiley
                
                var smileyRadius = Math.min(squareMaxX - squareMinX, squareMaxY - squareMinY) / 2 - 8;
                if (smileyRadius > 20) {
                    var centerX = Math.floor((squareMinX + squareMaxX) / 2 + offset.x - regionInImage.minX);
                    var centerY = Math.floor((squareMinY + squareMaxY) / 2 + offset.y - regionInImage.minY);
                    graphicsLibrary.paintIntersectedSmiley(targetImageData, smileyRadius, centerX, centerY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, /*thickness=*/5)
                    
                }
            }
            
            resolve();
        });
    };
    
    return SierpinskiDecoderWorker;
})();