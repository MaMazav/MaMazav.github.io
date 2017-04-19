var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var imageDecoder = new imageDecoderFramework.ImageDecoder(new GridImage());

var layer = new imageDecoderFramework.ImageDecoderRegionLayer({
    imageDecoder: imageDecoder,
    url: location.href.substring(0, location.href.lastIndexOf('/')) + '/grid-demo-url', // Must be absolute path
    latLngBounds: latLngBounds,
    workersLimit: 2});

layer.setExceptionCallback(console.log);

var map = L.map('leafletContainerGrid');
map.addLayer(layer);
map.fitBounds(latLngBounds);