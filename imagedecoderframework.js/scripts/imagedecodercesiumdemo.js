var rectangle = Cesium.Rectangle.fromDegrees(-2.0, -1.0, 2.0, 1.0);

var image = new imageDecoderFramework.CesiumImageDecoderLayerManager('DemoImageImplementation', {
    url: 'dummyUrl', // this argument is passed to DemoFetchClient.openInternal() function
    rectangle: rectangle
});

image.setExceptionCallback(console.log);

var cesiumViewer = new Cesium.Viewer('cesiumContainer');
image.open(cesiumViewer);
setTimeout(function delayedViewRectangle() {
	cesiumViewer.scene.camera.setView({destination: rectangle});
}, 100);
