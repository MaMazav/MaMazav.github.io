var rectangle = Cesium.Rectangle.fromDegrees(-2.0, -1.0, 2.0, 1.0);

var imageDecoderLayerManager = new imageDecoderFramework.CesiumImageDecoderLayerManager('DemoImageImplementation', {
    url: 'dummyUrl', // this argument is passed to DemoFetchClient.openInternal() function
    rectangle: rectangle
});

imageDecoderLayerManager.setExceptionCallback(console.log);

var cesiumLayerManagerViewer = new Cesium.Viewer('cesiumContainer');
imageDecoderLayerManager.open(cesiumLayerManagerViewer);
setTimeout(function delayedViewRectangle() {
	cesiumLayerManagerViewer.scene.camera.setView({destination: rectangle});
}, 100);
