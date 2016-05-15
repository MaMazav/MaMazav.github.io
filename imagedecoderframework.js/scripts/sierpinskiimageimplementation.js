var SierpinskiImageImplementation = {
    createFetcher: function createFetcher(url) {
        return new Promise(function(resolve, reject){
            // AJAX request. You can use AJAX wrapper from your favorite library instead
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (xhttp.readyState === 4 && xhttp.status === 200) {
                    var json = JSON.parse(xhttp.responseText);
                    resolve({
                        fetcher: new SierpinskiFetcher(json),
                        sizesParams: json
                    });
                }
            };
            xhttp.open('GET', url, true);
            xhttp.send();
        });
    },
    
    createPixelsDecoder: function createPixelsDecoder() {
        return new SierpinskiPixelsDecoder();
    },
    
    createImageParamsRetriever: function createImageParamsRetriever(imageParams) {
		return new SierpinskiImageParamsRetriever(imageParams);
    },
    
    getScriptsToImport: function getScriptsToImport() {
        // Works only in the page of ImageDecoderFramework.js/index.html!
        
        var baseUrl = location.href.substring(0, location.href.lastIndexOf('/')) + '/scripts/';
        var graphicslibraryPath = baseUrl + 'graphicslibrary.js';
        var sierpinskiImageImplementationPath = baseUrl + 'sierpinskiimageimplementation.js';
        var sierpinskiImageParamsRetrieverPath = baseUrl + 'sierpinskiimageparamsretriever.js';
        var sierpinskiFetcherPath = baseUrl + 'sierpinskifetcher.js';
        var sierpinskiDecoderPath = baseUrl + 'sierpinskipixelsdecoder.js';
        var absolutePaths = [
            graphicslibraryPath,
            sierpinskiImageImplementationPath,
			sierpinskiImageParamsRetrieverPath,
            sierpinskiFetcherPath,
            sierpinskiDecoderPath];
            
        return absolutePaths;
    }
};