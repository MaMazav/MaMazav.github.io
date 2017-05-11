var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var imageDecoder = imageDecoderFramework.ImageDecoder.fromImage(new GridImage(), {decodeWorkersLimit: 2});

var layer = new imageDecoderFramework.ImageDecoderRegionLayer({
    imageDecoder: imageDecoder,
    url: location.href.substring(0, location.href.lastIndexOf('/')) + '/grid-demo-url', // Must be absolute path
    latLngBounds: latLngBounds
});

layer.setExceptionCallback(console.log);

var map = L.map('leafletContainerGrid');
map.addLayer(layer);
map.fitBounds(latLngBounds);