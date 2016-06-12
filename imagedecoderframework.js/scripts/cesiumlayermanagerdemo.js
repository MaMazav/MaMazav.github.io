var rectangle = Cesium.Rectangle.fromDegrees(-2.0, -1.0, 2.0, 1.0);

var imageDecoderLayerManager = new imageDecoderFramework.CesiumImageDecoderLayerManager('SierpinskiProgressiveImageImplementation', {
    url: location.href.substring(0, location.href.lastIndexOf('/')) + '/sierpinskiimageurl.json', // Must be absolute path
    rectangle: rectangle
});

imageDecoderLayerManager.setExceptionCallback(console.log);

var cesiumLayerManagerViewer = new Cesium.Viewer('cesiumContainer', {
    // Only for demo purpose: avoid loading online data
    imageryProvider : Cesium.createTileMapServiceImageryProvider({
        url : Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
    }),
    baseLayerPicker : false,
    geocoder : false
});
imageDecoderLayerManager.open(cesiumLayerManagerViewer);
setTimeout(function delayedViewRectangle() {
    cesiumLayerManagerViewer.scene.camera.setView({destination: rectangle});
}, 100);
