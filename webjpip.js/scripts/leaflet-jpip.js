var map = L.map('leafletContainer');
var oldImage = null;

function showImage() {
    var url = document.getElementById('txtUrl').value;
    var latLngBounds = L.latLngBounds(L.latLng(-1.0, -2.0), L.latLng(1.0, 2.0));

    var image = new imageDecoderFramework.ImageDecoderRegionLayer({
        imageImplementationClassName: 'webjpip.JpipImageImplementation',
        url: url,
        latLngBounds: latLngBounds});

    image.setExceptionCallback(function(exception) {
        console.log(exception);

        // This message is only for demo purpose, you better use a non kdu_server to avoid this annoying bug...
        if (exception.indexOf('Cannot extract cid from cnew response') > 0) {
            alert('Jpip exception: ' + exception + '. That may be a kdu_server preview version bug, please restart the server');
        }
    });

    if (oldImage !== null) {
        map.removeLayer(oldImage);
        oldImage = null;
    }
    map.addLayer(image);
    map.fitBounds(latLngBounds);
    oldImage = image;
}