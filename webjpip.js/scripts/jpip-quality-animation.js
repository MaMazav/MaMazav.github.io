var qualityAnimationCanvas = document.getElementById('qualityAnimationCanvas');
var sliderQuality = document.getElementById('sliderQuality');
var offscreenCanvasByQuality;
var txtUrlQualityAnimation = document.getElementById('txtUrlQualityAnimation');
var statusSpan = document.getElementById('spanQualityAnimationStatus');
var divQualitySelector = document.getElementById('divQualitySelector');

function showQualityAnimation() {
    statusSpan.innerHTML = 'Loading...';
    var url = txtUrlQualityAnimation.value;
    var regionParams = {
        minX: 0,
        minY: 0,
        maxXExclusive: 512,
        maxYExclusive: 512,
        screenWidth : 512,
        screenHeight: 512
    };

    qualityAnimationCanvas.width  = regionParams.screenWidth;
    qualityAnimationCanvas.height = regionParams.screenHeight;
    
    var image = new webjpip.JpipImage({url: url});
    var imageDecoder = imageDecoderFramework.ImageDecoder.fromImage(image, {decodeWorkersLimit: 1});
    imageDecoder.open().then(function() {
        var maxQuality = imageDecoder.getLevelCalculator().getHighestQuality();
        var canvases = new Array(maxQuality + 1);
        var renderEndedPromises = new Array(maxQuality);
        for (var i = 1; i <= maxQuality; ++i) {
            canvases[i] = document.createElement('canvas');
            var imageForQuality = image.nonProgressive(/*quality=*/i);
            var imageDecoderForQuality = imageDecoderFramework.ImageDecoder.fromImage(
                imageForQuality, {decodeWorkersLimit: 1});
            canvases[i].width = regionParams.screenWidth;
            canvases[i].height = regionParams.screenHeight;
            var renderEnded = renderToOffscreenCanvas(canvases[i], regionParams, imageDecoderForQuality);
            renderEndedPromises.push(renderEnded);
        }
        imageDecoder.close(); // No need to wait for internal non progressive images to close. Connection remain opened until last close
        
        Promise.all(renderEndedPromises).then(function() {
            offscreenCanvasByQuality = canvases;
            sliderQuality.max = maxQuality;
            sliderQuality.value = Math.ceil(maxQuality / 2);
            divQualitySelector.style.visibility = 'visible';
            statusSpan.innerHTML = 'Slide to choose quality';
        });
    }).catch(jpipDemoExceptionCallback);
}

function renderToOffscreenCanvas(canvas, regionParams, imageDecoderForQuality) {
    return new Promise(function(resolve, reject) {
        imageDecoderForQuality.open().then(function() {
            imageDecoderFramework.ImageDecoder.renderToCanvas(
                    canvas,
                    regionParams,
                    imageDecoderForQuality)
                .then(function() {
                    imageDecoderForQuality.close();
                    resolve();
                }).catch(reject);
        }).catch(reject);
    });
}

function sliderQualityChanged() {
    var quality = +sliderQuality.value;
    var context = qualityAnimationCanvas.getContext('2d');
    context.drawImage(offscreenCanvasByQuality[quality], 0, 0);
    statusSpan.innerHTML = 'Quality: ' + quality;
}