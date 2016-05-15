var GridImageImplementation = {
    createFetcher: function createFetcher(url) {
        return new Promise(function(resolve, reject){
            // AJAX request. You can use AJAX wrapper from your favorite library instead
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (xhttp.readyState === 4 && xhttp.status === 200) {
                    var json = JSON.parse(xhttp.responseText);
                    resolve({
                        fetcher: new GridFetcher(json),
                        sizesParams: json
                    });
                }
            };
            xhttp.open('GET', url, true);
            xhttp.send();
        });
    },
    
    createPixelsDecoder: function createPixelsDecoder() {
        return new GridPixelsDecoder();
    },
    
    createImageParamsRetriever: function createImageParamsRetriever(imageParams) {
		return new GridImageParamsRetriever(imageParams);
    },
    
    getScriptsToImport: function getScriptsToImport() {
        // Works only in the page of ImageDecoderFramework.js/index.html!
        
        var baseUrl = location.href.substring(0, location.href.lastIndexOf('/')) + '/scripts/';
        var graphicslibraryPath = baseUrl + 'graphicslibrary.js';
        var gridImageImplementationPath = baseUrl + 'gridimageimplementation.js';
        var gridImageParamsRetrieverPath = baseUrl + 'gridimageparamsretriever.js';
        var gridFetcherPath = baseUrl + 'gridfetcher.js';
        var gridDecoderPath = baseUrl + 'gridpixelsdecoder.js';
        var absolutePaths = [
            graphicslibraryPath,
            gridImageImplementationPath,
			gridImageParamsRetrieverPath,
            gridFetcherPath,
            gridDecoderPath];
            
        return absolutePaths;
    }
};