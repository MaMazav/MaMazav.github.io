function collectSierpinskiSquares(regionMinX, regionMinY, regionMaxX, regionMaxY, carpetSize, minSquareSize, maxSquareSize, result) {
    result = result || [];
    collectSierpinskiSquaresRecursively(result, regionMinX, regionMinY, regionMaxX, regionMaxY, 0, 0, carpetSize, carpetSize, minSquareSize || 2, minSquareSize || 2, maxSquareSize, maxSquareSize);
    return result;
}

function collectSierpinskiSquaresRecursively(
    result,
    regionMinX, regionMinY, regionMaxX, regionMaxY,
    carpetMinX, carpetMinY, carpetMaxX, carpetMaxY,
    minSquareWidth, minSquareHeight, maxSquareWidth, maxSquareHeight) {
        
    if (carpetMinY > regionMaxY || carpetMaxY < regionMinY || carpetMinX > regionMaxX || carpetMaxX < regionMinX) {
        return;
    }
    var smallSquareHeight = (carpetMaxY - carpetMinY) / 3;
    var smallSquareWidth  = (carpetMaxX - carpetMinX) / 3;
    if (smallSquareHeight < minSquareHeight || smallSquareWidth < minSquareWidth) {
        return;
    }
    
    var ySmallSquares = [carpetMinY, carpetMinY + smallSquareHeight, carpetMaxY - smallSquareHeight, carpetMaxY];
    var xSmallSquares = [carpetMinX, carpetMinX + smallSquareWidth , carpetMaxX - smallSquareWidth , carpetMaxX];
    for (var ySquare = 0; ySquare < 3; ++ySquare) {
        for (var xSquare = 0; xSquare < 3; ++xSquare) {
            if (xSquare !== 1 || ySquare !== 1) {
                collectSierpinskiSquaresRecursively(
                    result,
                    regionMinX, regionMinY, regionMaxX, regionMaxY,
                    xSmallSquares[xSquare], ySmallSquares[ySquare], xSmallSquares[xSquare + 1], ySmallSquares[ySquare + 1],
                    minSquareWidth, minSquareHeight);
            }
        }
    }
    
    if (smallSquareHeight > maxSquareHeight || smallSquareWidth > maxSquareWidth) {
        return;
    }
    result.push(xSmallSquares[1]);
    result.push(ySmallSquares[1]);
    result.push(xSmallSquares[2]);
    result.push(ySmallSquares[2]);
}