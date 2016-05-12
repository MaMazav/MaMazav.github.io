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
        var graphicslibraryPath = baseUrl + 'graphicslibrary.js';
        var demoImageImplementationPath = baseUrl + 'demoimageimplementation.js';
        var demoFetchClientPath = baseUrl + 'demofetchclient.js';
        var demoDecoderPath = baseUrl + 'demopixelsdecoder.js';
        var absolutePaths = [
            graphicslibraryPath,
            demoImageImplementationPath,
            demoFetchClientPath,
            demoDecoderPath];
            
        return absolutePaths;
    },
    
    createImageParamsRetriever: function createImageParamsRetriever(imageParams) {
        return {
            getLevelWidth: function getLevelWidth(level) {
                return imageParams.lowestLevelWidth * Math.pow(2, level);
            },
            
            getLevelHeight: function getLevelHeight(level) {
                return imageParams.lowestLevelHeight * Math.pow(2, level);
            },

            getImageLevel: function getImageLevel() {
                return imageParams.imageLevel;
            },
            
            getLevel: function getDefaultNumResolutionLevels(regionImageLevel) {
                var log2 = Math.log(2);
                var levelX = Math.log(regionImageLevel.screenWidth  / (regionImageLevel.maxXExclusive - regionImageLevel.minX)) / log2;
                var levelY = Math.log(regionImageLevel.screenHeight / (regionImageLevel.maxYExclusive - regionImageLevel.minY)) / log2;
                var level = Math.ceil(Math.min(levelX, levelY));
                level = Math.max(0, level + imageParams.imageLevel);
                return level;
            },
            
            getNumResolutionLevelsForLimittedViewer: function getNumResolutionLevelsForLimittedViewer() {
                return imageParams.imageLevel + 1;
            },
            
            getLowestQuality: function getLowestQuality() {
                return 'arbitrary value';
            },
            
            getHighestQuality: function getHighestQuality() {
                return 'Another arbitrary value';
            }
        };
    }
};