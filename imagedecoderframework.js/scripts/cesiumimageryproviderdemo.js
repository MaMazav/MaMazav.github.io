var rectangle = Cesium.Rectangle.fromDegrees(-2.0, -1.0, 2.0, 1.0);

var imageryProvider = new imageDecoderFramework.ImageDecoderImageryProvider('SierpinskiImageImplementation', {
    url: location.href.substring(0, location.href.lastIndexOf('/')) + '/sierpinskiimageurl.json', // Must be absolute path
    rectangle: rectangle
});

imageryProvider.setExceptionCallback(console.log);

var cesiumImageryProviderViewer = new Cesium.Viewer('cesiumContainer', {
    // Only for demo purpose: avoid loading online data
    imageryProvider : Cesium.createTileMapServiceImageryProvider({
        url : Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
    }),
    baseLayerPicker : false,
    geocoder : false
});
imageryProvider.open(cesiumImageryProviderViewer);
cesiumImageryProviderViewer.scene.imageryLayers.addImageryProvider(imageryProvider);

setTimeout(function delayedViewRectangle() {
    cesiumImageryProviderViewer.scene.camera.setView({destination: rectangle});
}, 100);
