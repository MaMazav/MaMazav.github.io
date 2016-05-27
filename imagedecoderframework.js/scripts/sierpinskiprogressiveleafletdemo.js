var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var image = new imageDecoderFramework.ImageDecoderRegionLayer({
    imageImplementationClassName: 'SierpinskiProgressiveImageImplementation',
    url: location.href.substring(0, location.href.lastIndexOf('/')) + '/sierpinskiimageurl.json', // Must be absolute path
    latLngBounds: latLngBounds});

image.setExceptionCallback(console.log);

var map = L.map('leafletContainer');
map.addLayer(image);
map.fitBounds(latLngBounds);