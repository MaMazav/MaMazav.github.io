var imageDecoderForRenderToCanvasInst = null;
var renderToCanvasTargetCanvas = document.getElementById('renderToCanvasDemoCanvas');

function renderToCanvasByImageDecoder() {
    if (!imageDecoderForRenderToCanvasInst) {
        imageDecoderForRenderToCanvasInst = imageDecoderFramework.ImageDecoder.fromImage(new SierpinskiProgressiveImage(), {decodeWorkersLimit: 1});
        imageDecoderForRenderToCanvasInst.open().then(renderToCanvasByImageDecoder);
        return;
    }
    
    var regionParams = {
        minX: 150,
        minY: 50,
        maxXExclusive: 250,
        maxYExclusive: 150,
        screenWidth: 300,
        screenHeight: 300
    };
    
    var margin = 3;
    renderToCanvasTargetCanvas.width  = +regionParams.screenWidth + 2 * margin;
    renderToCanvasTargetCanvas.height = +regionParams.screenHeight + 2 * margin;
    var targetContext = renderToCanvasTargetCanvas.getContext('2d');
    targetContext.fillStyle = 'blue';
    targetContext.fillRect(0, 0, renderToCanvasTargetCanvas.width, renderToCanvasTargetCanvas.height);

    imageDecoderFramework.ImageDecoder.renderToCanvas(renderToCanvasTargetCanvas, regionParams, imageDecoderForRenderToCanvasInst, /*x=*/margin, /*y=*/margin)
        .then(function() {
            console.log('Fetch finished successfully!');
        }).catch(function() {
            console.log('Fetch terminated unsuccessfully :(');
        }).then(function() {
            imageDecoderForRenderToCanvasInst.close();
            imageDecoderForRenderToCanvasInst = null;
        });
}