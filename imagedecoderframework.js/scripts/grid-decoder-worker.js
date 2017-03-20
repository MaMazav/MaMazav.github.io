'use strict';

var GridDecoderWorker = (function GridDecoderWorkerClosure() {
	var BORDER_THICKNESS = 5;
	
    function GridDecoderWorker() {
    }
    
    GridDecoderWorker.prototype.start = function start(decoderInput, taskKey) {
        return new Promise(function(resolve, reject) {
            var targetImageOffsetX = decoderInput.imagePartParams.minX;
            var targetImageOffsetY = decoderInput.imagePartParams.minY;
            var width  = decoderInput.imagePartParams.maxXExclusive - targetImageOffsetX;
            var height = decoderInput.imagePartParams.maxYExclusive - targetImageOffsetY;
            var targetImageData = new ImageData(width, height);
            for (var i = 0; i < decoderInput.tileIndices.length; ++i) {
                var minY = Math.max(decoderInput.tileIndices[i].tileY * decoderInput.tileHeight - targetImageOffsetY, 0);
                var minX = Math.max(decoderInput.tileIndices[i].tileX * decoderInput.tileWidth  - targetImageOffsetX, 0);
                var maxY = Math.min(decoderInput.tileIndices[i].tileY * decoderInput.tileHeight - targetImageOffsetY + decoderInput.tileHeight, targetImageData.height);
                var maxX = Math.min(decoderInput.tileIndices[i].tileX * decoderInput.tileWidth  - targetImageOffsetX + decoderInput.tileWidth , targetImageData.width );
                
                // Fill all area with red color
                
                var stride = width * 4;
                for (var y = minY; y < maxY; ++y) {
                    var yOriginalImage = targetImageOffsetY + y;
                    var offset = minX * 4 + stride * y;
                    for (var x = minX; x < maxX; ++x) {
                        var xOriginalImage = targetImageOffsetX + x;
                        
                        var isTileBorder = yOriginalImage % decoderInput.tileHeight < BORDER_THICKNESS || xOriginalImage % decoderInput.tileWidth < BORDER_THICKNESS;
                        targetImageData.data[offset++] = isTileBorder ? 255 : decoderInput.tileContents[i].red;
                        targetImageData.data[offset++] = isTileBorder ? 0   : decoderInput.tileContents[i].green;
                        targetImageData.data[offset++] = isTileBorder ? 255 : decoderInput.tileContents[i].blue;
                        targetImageData.data[offset++] = 255; // Alpha
                    }
                }
                
                resolve(targetImageData);
            }
        });
    };
    
    return GridDecoderWorker;
})();