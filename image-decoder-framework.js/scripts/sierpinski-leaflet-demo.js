var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var imageDecoder = imageDecoderFramework.ImageDecoder.fromImage(new SierpinskiImage());

var layer = new imageDecoderFramework.ImageDecoderRegionLayer({
    imageDecoder: imageDecoder,
    latLngBounds: latLngBounds});

layer.setExceptionCallback(console.log);

var map = L.map('leafletContainer');
map.addLayer(layer);
map.fitBounds(latLngBounds);