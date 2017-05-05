var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var image = new SierpinskiImage();

var layer = new imageDecoderFramework.ImageDecoderRegionLayer({
    image: image,
    latLngBounds: latLngBounds});

layer.setExceptionCallback(console.log);

var map = L.map('leafletContainer');
map.addLayer(layer);
map.fitBounds(latLngBounds);