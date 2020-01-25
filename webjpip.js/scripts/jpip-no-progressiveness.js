var mapNoProgressiveness = L.map('leafletContainerNoProgressiveness');
var oldLayerNoProgressiveness = {};

function showImageNoProgressiveness() {
    var url = document.getElementById('txtNoProgressivenessUrl').value;
    var image = new webjpip.JpipImage({url: url}).nonProgressive(/*quality=*/1);
    showImageInLeaflet(image, mapNoProgressiveness, oldLayerNoProgressiveness); // Call same function from the first example
}