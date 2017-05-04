var viewer;

var url = 'dummy-url';
var image = new SierpinskiProgressiveImage({decodeWorkersLimit: 1});
imageViewer = new imageDecoderFramework.ImageViewer(image, canvasUpdatedCallback, {
    cartographicBounds: {
        west: 0,
        east: 1,
        south: 0,
        north: 1
    },
    adaptProportions: true
});
imageViewer.open(url).then(function() {
    var imageBounds = imageViewer.getBounds();
    viewer = graphicsLibrary.createViewer('viewerDiv', viewChangedCallback, /*startPosition=*/{
        west: imageBounds.west,
        east: imageBounds.east,
        south: imageBounds.south,
        north: imageBounds.north
    });
    imageViewer.setTargetCanvas(viewer.getCanvas());
});
imageViewer.setExceptionCallback(function exceptionCallback(e) {
    console.log('Error in ImageViewer: ' + e);
});

function canvasUpdatedCallback(newPosition) {
    // newPosition === null ==> canvas pixels were updated
    // newPosition !== null ==> canvas pixels and canvas position were updated
    if (newPosition !== null) {
        viewer.updateCanvasPosition(newPosition);
    }
}

function viewChangedCallback(newPosition, screenPixelsWidth, screenPixelsHeight) {
    imageViewer.updateViewArea({
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