var targetCanvas = document.getElementById('jpipRegionCanvas');

function showRegion() {
    var url = document.getElementById('txtUrlRegion').value;
    var regionParams = {
        minX: document.getElementById('txtMinX').value,
        minY: document.getElementById('txtMinY').value,
        maxXExclusive: document.getElementById('txtMaxX').value,
        maxYExclusive: document.getElementById('txtMaxY').value,
        screenWidth : document.getElementById('txtScreenWidth' ).value,
        screenHeight: document.getElementById('txtScreenHeight').value
    };
    
    var image = new webjpip.JpipImage({url: url});
    showRegionInCanvas(image, targetCanvas, regionParams);
}

function showRegionInCanvas(image, canvas, regionParams) {
    canvas.width  = +regionParams.screenWidth;
    canvas.height = +regionParams.screenHeight;
    
    var layer = imageDecoderFramework.ImageDecoder.fromImage(image, {decodeWorkersLimit: 1});
    layer.open().then(function() {
        imageDecoderFramework.ImageDecoder.renderToCanvas(canvas, regionParams, layer, /*x=*/0, /*y=*/0)
            .then(function then() {
                layer.close();
            });
    }).catch(jpipDemoExceptionCallback);
}