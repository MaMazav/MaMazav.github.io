var targetCanvas = document.getElementById('jpipRegionCanvas');
var targetContext = targetCanvas.getContext('2d');

function showRegionManual() {
    var url = document.getElementById('txtUrlRegion').value;
    var quality = document.getElementById('txtQuality').value
    var regionParams = {
        minX: document.getElementById('txtMinX').value,
        minY: document.getElementById('txtMinY').value,
        maxXExclusive: document.getElementById('txtMaxX').value,
        maxYExclusive: document.getElementById('txtMaxY').value,
        screenWidth : document.getElementById('txtScreenWidth' ).value,
        screenHeight: document.getElementById('txtScreenHeight').value
    };

    targetCanvas.width  = regionParams.screenWidth;
    targetCanvas.height = regionParams.screenHeight;
    
    var alignedParams, imagePartParams;
    var layer = imageDecoderFramework.ImageDecoder.fromImage(new webjpip.JpipImage(), {decodeWorkersLimit: 1});
    layer.open(url).then(function() {
        alignedParams = imageDecoderFramework.ImageDecoder.alignParamsToTilesAndLevel(regionParams, layer);
        imagePartParams = alignedParams.imagePartParams;
        imagePartParams.quality = quality;

        layer.requestPixelsProgressive(
            imagePartParams,
            regionDecodedCallback,
            function terminatedCallback() {
                layer.close();
            });
    }).catch(jpipDemoExceptionCallback);
    
    var tempCanvas, tempContext;
    function regionDecodedCallback(partialDecodeResult) {
        if (!tempCanvas) {
            tempCanvas = document.createElement('canvas');
            tempCanvas.width  = imagePartParams.maxXExclusive - imagePartParams.minX;
            tempCanvas.height = imagePartParams.maxYExclusive - imagePartParams.minY;

            tempContext = tempCanvas.getContext('2d');
            tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
        
        tempContext.putImageData(
            partialDecodeResult.imageData,
            partialDecodeResult.xInOriginalRequest,
            partialDecodeResult.yInOriginalRequest);
        
        // Crop and scale original request region (before align) into canvas
        var crop = alignedParams.croppedScreen;
        targetContext.drawImage(tempCanvas,
            crop.minX, crop.minY, crop.maxXExclusive - crop.minX, crop.maxYExclusive - crop.minY,
            0, 0, regionParams.screenWidth, regionParams.screenHeight);
    }
}