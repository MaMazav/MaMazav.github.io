var VectorImageImplementation = {
    createFetchClient: function createFetchClient() {
        var statusCallback;
        var imageParams;
        
        return new DemoFetchClient();
    },
    
    createDecoder: function createDecoder() {
        return { decode: function decode(dataForDecode) {
            return new Promise(function(resolve, reject) {
            });
        }};
    },
    
    getScriptsToImport: function getScriptsToImport() {
        // TODO: Prettify this
    
        // Works only in the page of ImageDecoderFramework.js/index.html!
        
        var baseUrl = location.href.substring(0, location.href.lastIndexOf('/'));
        var demoImageImplementationPath = baseUrl + '/demoimageimplementation.js';
        var demoFetchClientPath = baseUrl + '/demofetchclient.js';
        var absolutePaths = [
            demoImageImplementationPath,
            demoFetchClientPath];
            
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
                return 2;
            }
        };
    },
    
    // TODO: Prettify those
    
    getTransferablePathsOfRequestCallback: function getTransferablePathsOfRequestCallback() {
        return [];
    },
    
    getTransferablesOfRequestCallback: function getTransferablesOfRequestCallback(dataForDecode) {
        return [];
    }
};

