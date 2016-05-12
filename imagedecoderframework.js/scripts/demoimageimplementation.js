var DemoImageImplementation = {
    createFetchClient: function createFetchClient() {
        return new DemoFetchClient();
    },
    
    createPixelsDecoder: function createPixelsDecoder() {
        return new DemoPixelsDecoder();
    },
    
    createImageParamsRetriever: function createImageParamsRetriever(imageParams) {
		return new DemoImageParamsRetriever(imageParams);
    },
    
    getScriptsToImport: function getScriptsToImport() {
        // Works only in the page of ImageDecoderFramework.js/index.html!
        
        var baseUrl = location.href.substring(0, location.href.lastIndexOf('/')) + '/scripts/';
        var graphicslibraryPath = baseUrl + 'graphicslibrary.js';
        var demoImageImplementationPath = baseUrl + 'demoimageimplementation.js';
        var demoImageParamsRetrieverPath = baseUrl + 'demoimageparamsretriever.js';
        var demoFetchClientPath = baseUrl + 'demofetchclient.js';
        var demoDecoderPath = baseUrl + 'demopixelsdecoder.js';
        var absolutePaths = [
            graphicslibraryPath,
            demoImageImplementationPath,
			demoImageParamsRetrieverPath,
            demoFetchClientPath,
            demoDecoderPath];
            
        return absolutePaths;
    }
};