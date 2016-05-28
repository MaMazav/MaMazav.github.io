var imageDecoder = null;
var url = location.href.substring(0, location.href.lastIndexOf('/')) + '/sierpinskiimageurl.json';
var targetCanvas = document.getElementById('imageDecoderDemoCanvas');
var targetContext = targetCanvas.getContext('2d');

function decodeRegionByImageDecoder() {
    if (!imageDecoder) {
        imageDecoder = new imageDecoderFramework.ImageDecoder('SierpinskiProgressiveImageImplementation');
        imageDecoder.open(url).then(function() {
            decodeRegionByImageDecoder();
            setTimeout(closeImage, 60*1000);
        });
        return;
    }
    
    var regionParams = {
        minX: 100,
        minY: 100,
        maxXExclusive: 200,
        maxYExclusive: 200,
        screenWidth: 300,
        screenHeight: 300
    };
    
    targetCanvas.width  = regionParams.screenWidth;
    targetCanvas.height = regionParams.screenHeight;

    var alignedParams = imageDecoder.alignParamsToTilesAndLevel(regionParams);
    var imagePartParams = alignedParams.imagePartParams;
    imagePartParams.quality = 1;
    
    console.log('Actual fetch parameters: ' + JSON.stringify(alignedParams.imagePartParams));
    console.log('Position in image: ' + JSON.stringify(alignedParams.positionInImage));
    console.log('croppedScreen: ' + JSON.stringify(alignedParams.croppedScreen));
    
    var tempCanvas = document.createElement('canvas');
    var tempContext = tempCanvas.getContext('2d');
    tempCanvas.width  = imagePartParams.maxXExclusive - imagePartParams.minX;
    tempCanvas.height = imagePartParams.maxYExclusive - imagePartParams.minY;
    tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    imageDecoder.requestPixelsProgressive(
        imagePartParams,
        regionDecodedCallback,
        requestTerminatedCallback);
    
    function regionDecodedCallback(partialDecodeResult) {
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

function requestTerminatedCallback(isAborted) {
    if (isAborted) {
        console.log('Fetch terminated unsuccessfully :(');
    } else {
        console.log('Fetch finished successfully!');
    }
}

function closeImage() {
    var localImageDecoder = imageDecoder;
    imageDecoder = null;
    localImageDecoder.close().then(function() {
        console.log('Image closed successfully');
    });
}