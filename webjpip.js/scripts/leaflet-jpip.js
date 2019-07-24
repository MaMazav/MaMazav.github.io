var map = L.map('leafletContainer');
var oldLayer = null;

function showImage() {
    var url = document.getElementById('txtUrl').value;
    var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

    var imageDecoder = imageDecoderFramework.ImageDecoder.fromImage(new webjpip.JpipImage());
    var layer = new imageDecoderFramework.ImageDecoderRegionLayer({
        imageDecoder: imageDecoder,
        url: url,
        latLngBounds: latLngBounds});

    layer.setExceptionCallback(jpipDemoExceptionCallback);

    if (oldLayer !== null) {
        map.removeLayer(oldLayer);
        oldLayer = null;
    }
    map.addLayer(layer);
    map.fitBounds(latLngBounds);
    oldLayer = layer;
}

function jpipDemoExceptionCallback(exception) {
    // This message is only for demo purpose, you better use a non kdu_server to avoid this annoying bug...
    // Also if the server requires CORS header avoid using Explorer and Edge.
    if (exception.indexOf('Cannot extract cid from cnew response') > 0) {
        alert('Jpip exception: ' + exception +
            '. That may be a kdu_server preview version bug, please restart the server.' +
            'If you use Edge or Explorer, it may also be a CORS bug with ' +
            'Access-Control-Expose-Headers header, try using another browser');
    }
}