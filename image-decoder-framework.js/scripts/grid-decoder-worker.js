'use strict';

var GridDecoderWorker = (function GridDecoderWorkerClosure() {
    var BORDER_THICKNESS = 5;
    
    function GridDecoderWorker() {
        imageDecoderFramework.GridDecoderWorkerBase.call(this);
    }
    
    GridDecoderWorker.prototype = Object.create(imageDecoderFramework.GridDecoderWorkerBase.prototype);
    
    GridDecoderWorker.prototype.decodeRegion = function decodeRegion(targetImageData, offset, regionInImage, tile) {
        var stride = 4 * targetImageData.width;
        var startLineOffset = 4 * offset.x + stride * offset.y;
        for (var y = regionInImage.minY; y < regionInImage.maxYExclusive; ++y) {
            var pixelOffset = startLineOffset;
            for (var x = regionInImage.minX; x < regionInImage.maxXExclusive; ++x) {
                var isTileBorder =
                    (y - tile.position.minY < BORDER_THICKNESS) ||
                    (x - tile.position.minX < BORDER_THICKNESS) ||
                    (tile.position.maxYExclusive - y < BORDER_THICKNESS) ||
                    (tile.position.maxXExclusive - x < BORDER_THICKNESS);
                    
                targetImageData.data[pixelOffset++] = isTileBorder ? 255 : tile.content.red;
                targetImageData.data[pixelOffset++] = isTileBorder ? 0   : tile.content.green;
                targetImageData.data[pixelOffset++] = isTileBorder ? 255 : tile.content.blue;
                targetImageData.data[pixelOffset++] = 255; // Alpha
            }
            startLineOffset += stride;
        }
        
        return Promise.resolve(targetImageData);
    };
    
    return GridDecoderWorker;
})();