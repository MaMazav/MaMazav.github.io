var DemoImageImplementation = {
    createFetchClient: function createFetchClient() {
        var statusCallback;
        var imageParams;
        
        return new DemoFetchClient();
    },
    
    createPixelsDecoder: function createPixelsDecoder() {
        return new DemoPixelsDecoder();
    },
    
    getScriptsToImport: function getScriptsToImport() {
        // TODO: Prettify this
    
        // Works only in the page of ImageDecoderFramework.js/index.html!
        
        var baseUrl = location.href.substring(0, location.href.lastIndexOf('/')) + '/scripts/';
        var demoImageImplementationPath = baseUrl + 'demoimageimplementation.js';
        var demoFetchClientPath = baseUrl + 'demofetchclient.js';
		var demoDecoderPath = baseUrl + 'demopixelsdecoder.js';
        var absolutePaths = [
            demoImageImplementationPath,
            demoFetchClientPath,
			demoDecoderPath];
            
        return absolutePaths;
    },
    
    createImageParamsRetriever: function createImageParamsRetriever(imageParams) {
        return {
            getLevelWidth: function getLevelWidth(level) {
                return imageParams.levelWidths[level || 0];
            },
            
            getLevelHeight: function getLevelHeight(level) {
                return imageParams.levelHeights[level || 0];
            },
            
            getDefaultNumResolutionLevels: function getDefaultNumResolutionLevels() {
                return imageParams.numLevels;
            },
            
            getDefaultNumQualityLayers: function getDefaultNumQualityLayers() {
                return 1;
            }
        };
    }
};