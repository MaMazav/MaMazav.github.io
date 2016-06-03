var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var image = new imageDecoderFramework.ImageDecoderRegionLayer({
    imageImplementationClassName: 'GridImageImplementation',
    url: location.href.substring(0, location.href.lastIndexOf('/')) + '/gridimageurl.json', // Must be absolute path
    latLngBounds: latLngBounds,
    workersLimit: 2});

image.setExceptionCallback(console.log);

var map = L.map('leafletContainerGrid');
map.addLayer(image);
map.fitBounds(latLngBounds);