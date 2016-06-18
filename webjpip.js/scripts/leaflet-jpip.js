var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var image = new imageDecoderFramework.ImageDecoderRegionLayer({
    imageImplementationClassName: 'webjpip.JpipImageImplementation',
    url: 'http://kdu-server:8080/D:%5Cweb%5Cjpeg2000tries%5Ccabs.j2k',
    latLngBounds: latLngBounds});

image.setExceptionCallback(console.log);

var map = L.map('leafletContainer');
map.addLayer(image);
map.fitBounds(latLngBounds);