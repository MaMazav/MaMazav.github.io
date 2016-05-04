var rectangle = Cesium.Rectangle.fromDegrees(-2.0, -1.0, 2.0, 1.0);

var imageryProvider = new imageDecoderFramework.ImageDecoderImageryProvider('DemoImageImplementation', {
    url: 'dummyUrl', // this argument is passed to DemoFetchClient.openInternal() function
    rectangle: rectangle
});

imageryProvider.setExceptionCallback(console.log);

var cesiumImageryProviderViewer = new Cesium.Viewer('cesiumContainer');
imageryProvider.open(cesiumImageryProviderViewer);
cesiumImageryProviderViewer.scene.imageryLayers.addImageryProvider(imageryProvider);

setTimeout(function delayedViewRectangle() {
	cesiumImageryProviderViewer.scene.camera.setView({destination: rectangle});
}, 100);
