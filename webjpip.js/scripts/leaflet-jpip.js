var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var image = new imageDecoderFramework.ImageDecoderRegionLayer({
    imageImplementationClassName: 'webjpip.JpipImageImplementation',
    url: 'http://kdu-server/path',
    latLngBounds: latLngBounds});

image.setExceptionCallback(function(exception) {
    console.log(exception);
});

var map = L.map('leafletContainer');
map.addLayer(image);
map.fitBounds(latLngBounds);