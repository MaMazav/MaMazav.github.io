var targetCustomProgressivenessCanvas = document.getElementById('jpipRegionCustomProgressivenessCanvas');

function showRegionCustomProgressiveness() {
    var url = document.getElementById('txtCustomProgressivenessUrl').value;
    var regionParams = {
        minX: 0,
        minY: 0,
        maxXExclusive: 256,
        maxYExclusive: 256,
        screenWidth : 256,
        screenHeight: 256,
    };
    
    var progressiveness = [
        { minNumQualityLayers: 1, forceMaxQuality: 'force' },
        { minNumQualityLayers: 2, forceMaxQuality: 'no' },
        { minNumQualityLayers: 'max' }
    ];
    var image = new webjpip.JpipImage({url: url}).customProgressive(progressiveness);
    showRegionInCanvas(image, targetCustomProgressivenessCanvas, regionParams);
}
