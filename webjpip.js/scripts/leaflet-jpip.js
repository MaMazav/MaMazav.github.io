var map = L.map('leafletContainer');
var oldLayer = {};

function showImage() {
    var url = document.getElementById('txtUrl').value;
    var image = new webjpip.JpipImage({url: url});
    showImageInLeaflet(image, map, oldLayer);
}

function showImageInLeaflet(image, leafletMap, oldLayerToRemove) {
    var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

    var imageDecoder = imageDecoderFramework.ImageDecoder.fromImage(image);
    var layer = new imageDecoderFramework.ImageDecoderRegionLayer({
        imageDecoder: imageDecoder,
        latLngBounds: latLngBounds});

    layer.setExceptionCallback(jpipDemoExceptionCallback);

    if (oldLayerToRemove.layer) {
        leafletMap.removeLayer(oldLayerToRemove.layer);
        oldLayerToRemove.layer = null;
    }
    leafletMap.addLayer(layer);
    leafletMap.fitBounds(latLngBounds);
    oldLayerToRemove.layer = layer;
}

function jpipDemoExceptionCallback(exception) {
    // kdu_server has a bug. This message is only for demo purpose and alerts when the bug is discovered.
    // Better use a non kdu_server to avoid this annoying bug...
    // Also if the server requires CORS header avoid using Explorer and Edge.
    if (exception.indexOf('Cannot extract cid from cnew response') > 0) {
        alert('Jpip exception: ' + exception +
            '. That may be a kdu_server preview version bug, please restart the server.' +
            'If you use Edge or Explorer, it may also be a CORS bug with ' +
            'Access-Control-Expose-Headers header, try using another browser');
    }
}