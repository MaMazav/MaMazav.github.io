var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

var image = new imageDecoderFramework.ImageDecoderRegionLayer({
    imageImplementationClassName: 'DemoImageImplementation',
    url: 'dummyUrl', // this argument is passed to DemoFetchClient.openInternal() function
    latLngBounds: latLngBounds});

image.setExceptionCallback(console.log);

var map = L.map('leafletContainer');
map.addLayer(image);
map.fitBounds(latLngBounds);