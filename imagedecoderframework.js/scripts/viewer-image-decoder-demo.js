var viewer;

var url = 'dummy-url';
var imageDecoder = new imageDecoderFramework.ImageDecoder(new SierpinskiProgressiveImage(), {workersLimit: 1});
viewerImageDecoder = new imageDecoderFramework.ViewerImageDecoder(imageDecoder, canvasUpdatedCallback, {
    cartographicBounds: {
        west: 0,
        east: 1,
        south: 0,
        north: 1
    },
    adaptProportions: true,
    workersLimit: 3
});
viewerImageDecoder.open(url).then(function() {
    var imageBounds = viewerImageDecoder.getBounds();
    viewer = graphicsLibrary.createViewer('viewerDiv', viewChangedCallback, /*startPosition=*/{
        west: imageBounds.west,
        east: imageBounds.east,
        south: imageBounds.south,
        north: imageBounds.north
    });
    viewerImageDecoder.setTargetCanvas(viewer.getCanvas());
});
viewerImageDecoder.setExceptionCallback(function exceptionCallback(e) {
    console.log('Error in ViewerImageDecoder: ' + e);
});

function canvasUpdatedCallback(newPosition) {
    // newPosition === null ==> canvas pixels were updated
    // newPosition !== null ==> canvas pixels and canvas position were updated
    if (newPosition !== null) {
        viewer.updateCanvasPosition(newPosition);
    }
}

function viewChangedCallback(newPosition, screenPixelsWidth, screenPixelsHeight) {
    viewerImageDecoder.updateViewArea({
        rectangle: {
            west:  newPosition.west,
            east:  newPosition.east,
            south: newPosition.south,
            north: newPosition.north,
        },
        screenSize: {
            x: screenPixelsWidth,
            y: screenPixelsHeight
        }
    });
}