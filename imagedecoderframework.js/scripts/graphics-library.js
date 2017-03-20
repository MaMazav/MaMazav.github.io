var graphicsLibrary = {
    createSierpinskiSquaresCollector: function createSierpinskiSquaresCollector(
		regionMinX, regionMinY, regionMaxX, regionMaxY, carpetSize) {
		
		var collectedSquares = [];
		var nextStageStartRegions = [0, 0, carpetSize, carpetSize];
		
		var result = {
			getCollectedSquaresCoordinates: function getCollectedSquares() {
				return collectedSquares;
			},
			
			collect: function collect(minSquareSize) {
				var startRegion = nextStageStartRegions;
				nextStageStartRegions = [];
				for (var i = 0; i < startRegion.length; i += 4) {
					collectSierpinskiSquaresRecursively(
						regionMinX, regionMinY, regionMaxX, regionMaxY,
						startRegion[i], startRegion[i + 1], startRegion[i + 2], startRegion[i + 3],
						minSquareSize || 2, minSquareSize || 2);
				}
			}
		};

        function collectSierpinskiSquaresRecursively(
            regionMinX, regionMinY, regionMaxX, regionMaxY,
            carpetMinX, carpetMinY, carpetMaxX, carpetMaxY,
            minSquareWidth, minSquareHeight) {
                
            if (carpetMinY > regionMaxY || carpetMaxY < regionMinY || carpetMinX > regionMaxX || carpetMaxX < regionMinX) {
                return;
            }
            var smallSquareHeight = (carpetMaxY - carpetMinY) / 3;
            var smallSquareWidth  = (carpetMaxX - carpetMinX) / 3;
            if (smallSquareHeight < minSquareHeight || smallSquareWidth < minSquareWidth) {
				nextStageStartRegions.push(carpetMinX);
				nextStageStartRegions.push(carpetMinY);
				nextStageStartRegions.push(carpetMaxX);
				nextStageStartRegions.push(carpetMaxY);
                return;
            }
            
            var ySmallSquares = [carpetMinY, carpetMinY + smallSquareHeight, carpetMaxY - smallSquareHeight, carpetMaxY];
            var xSmallSquares = [carpetMinX, carpetMinX + smallSquareWidth , carpetMaxX - smallSquareWidth , carpetMaxX];
            for (var ySquare = 0; ySquare < 3; ++ySquare) {
                for (var xSquare = 0; xSquare < 3; ++xSquare) {
                    if (xSquare !== 1 || ySquare !== 1) {
                        collectSierpinskiSquaresRecursively(
                            regionMinX, regionMinY, regionMaxX, regionMaxY,
                            xSmallSquares[xSquare], ySmallSquares[ySquare], xSmallSquares[xSquare + 1], ySmallSquares[ySquare + 1],
                            minSquareWidth, minSquareHeight);
                    }
                }
            }
            
            collectedSquares.push(xSmallSquares[1]);
            collectedSquares.push(ySmallSquares[1]);
            collectedSquares.push(xSmallSquares[2]);
            collectedSquares.push(ySmallSquares[2]);
        }
        
        return result;
    },
    
    paintIntersectedCircle: function(targetImageData, radius, centerX, centerY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness) {
        thickness = thickness || 1;
        var stride = targetImageData.width * 4;
        for (var t = 0; t < thickness; ++t) {
            var circleRadiusForThickness = radius + t;
            var circleRadiusSquare = circleRadiusForThickness * circleRadiusForThickness;
            var minXInCircle = Math.max(intersectMinX - centerX, -circleRadiusForThickness);
            var maxXInCircle = Math.min(intersectMaxX - centerX,  circleRadiusForThickness);
            var minTheta = Math.asin(minXInCircle / circleRadiusForThickness);
            var maxTheta = Math.asin(maxXInCircle / circleRadiusForThickness);
            var thetaDiff = 1 / (2 * circleRadiusForThickness);
            for (var theta = minTheta; theta < maxTheta; theta += thetaDiff) {
                var x     = Math.floor(circleRadiusForThickness * Math.sin(theta) + centerX);
                var yDiff = circleRadiusForThickness * Math.cos(theta);;
                var yUp   = Math.floor(centerY + yDiff);
                var yDown = Math.floor(centerY - yDiff);
                
                if (yUp > intersectMinY && yUp < intersectMaxY) {
                    var offset = x * 4 + yUp * stride;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                }
                if (yDown > intersectMinY && yDown < intersectMaxY) {
                    var offset = x * 4 + yDown * stride;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                    targetImageData.data[offset++] = 255;
                }
            }
        }
    },
    
    fillGradient: function(targetImageData, minX, minY, maxX, maxY, minCb, minCr, maxCb, maxCr) {
        var stride = targetImageData.width * 4;
        var startLineOffset = minX * 4 + minY * stride;
        var crScale = (maxCr - minCr) / (maxY - minY);
        var cbScale = (maxCb - minCb) / (maxX - minX);

        for (var i = 0; i < maxY - minY; ++i) {
            var offset = startLineOffset;
            startLineOffset += stride;
            for (var j = 0; j < maxX - minX; ++j) {
                // Some demonstration calculation
                var intensity = 230;
                var cr = crScale * i + minCr;
                var cb = cbScale * j + minCb;
                var r = intensity + 1.402 * (cr - 128);
                var g = intensity - 0.34414 * (cb - 128) - 0.1414 * (cr - 128);
                var b = intensity + 1.772 * (cb - 128);
                
                targetImageData.data[offset++] = r; // Red
                targetImageData.data[offset++] = g; // Green
                targetImageData.data[offset++] = b; // Blue
                targetImageData.data[offset++] = 255; // Alpha
            }
        }
    },
    
    inverseColors: function(targetImageData, minX, minY, maxX, maxY) {
        var stride = targetImageData.width * 4;
        var startLineOffset = minX * 4 + minY * stride;
        
        for (var y = minY; y < maxY; ++y) {
            var offset = startLineOffset;
            startLineOffset += stride;
            for (var x = minX; x < maxX; ++x) {
                targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                targetImageData.data[offset] = 255 - targetImageData.data[offset++];
                targetImageData.data[offset++] = 255; // Alpha
            }
        }
    },
	
	paintIntersectedSmiley: function(targetImageData, radius, centerX, centerY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness) {
		graphicsLibrary.paintIntersectedCircle(
			targetImageData, radius, centerX, centerY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness);
		
		var eyeRadius = radius / 10;
		var eyeY = centerY - radius * 0.5;
		var  leftEyeX = centerX - radius * 0.5;
		var rightEyeX = centerX + radius * 0.5;
		graphicsLibrary.paintIntersectedCircle(
			targetImageData, eyeRadius,  leftEyeX, eyeY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness);
		graphicsLibrary.paintIntersectedCircle(
			targetImageData, eyeRadius, rightEyeX, eyeY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness);
		
		var mouthY = centerY + radius * 0.5;
		var mouthRadius = radius / 5;
		graphicsLibrary.paintIntersectedCircle(
			targetImageData, mouthRadius, centerX, mouthY, intersectMinX, intersectMinY, intersectMaxX, intersectMaxY, thickness);

	},
    
    createViewer: function(divContainerId, viewChangedCallback, startPosition) {
        var viewerElement;
        var viewerCanvas;
        buildViewerHtmlElements();
        
        var viewerCanvasPosition = null;
        var viewerElementPosition = JSON.parse(JSON.stringify(startPosition));
        
        setTimeout(function() {
            moveViewer(0, 0, 0, 0);
        }, 0);
        
        return {
            getCanvas: function() {
                return viewerCanvas;
            },
            
            updateCanvasPosition: function(newPosition) {
                viewerCanvasPosition = JSON.parse(JSON.stringify(newPosition));

                fixAspectRatio();
                setCanvasPosition();
            }
        };
        
        function setCanvasPosition() {
            var resolution = viewerElement.clientWidth  / (viewerElementPosition.east - viewerElementPosition.west );
            var viewerCanvasLeft   = (viewerCanvasPosition .west  - viewerElementPosition.west ) * resolution;
            var viewerCanvasTop    = (viewerElementPosition.north - viewerCanvasPosition .north) * resolution;
            var viewerCanvasWidth  = (viewerCanvasPosition .east  - viewerCanvasPosition .west ) * resolution;
            var viewerCanvasHeight = (viewerCanvasPosition .north - viewerCanvasPosition .south) * resolution;
            viewerCanvas.style.left   = viewerCanvasLeft   + 'px';
            viewerCanvas.style.top    = viewerCanvasTop    + 'px';
            viewerCanvas.style.width  = viewerCanvasWidth  + 'px';
            viewerCanvas.style.height = viewerCanvasHeight + 'px';
        }
        
        function fixAspectRatio() {
            var width  = viewerElementPosition.east  - viewerElementPosition.west;
            var height = viewerElementPosition.north - viewerElementPosition.south;

            var cartographicRatio = width / height;
            var pixelRatio = viewerElement.clientWidth / viewerElement.clientHeight;
            width  = cartographicRatio > pixelRatio ? width  : height * pixelRatio;
            height = cartographicRatio < pixelRatio ? height : width  / pixelRatio;

            var centerX = (viewerElementPosition.east  + viewerElementPosition.west ) / 2;
            var centerY = (viewerElementPosition.north + viewerElementPosition.south) / 2;
            viewerElementPosition.west  = centerX - width  / 2;
            viewerElementPosition.east  = centerX + width  / 2;
            viewerElementPosition.south = centerY - height / 2;
            viewerElementPosition.north = centerY + height / 2;
        }

        function moveViewer(westDelta, eastDelta, southDelta, northDelta) {
            if (viewerElementPosition === null) {
                alert('Image has not been loaded yet');
                return;
            }
            
            fixAspectRatio();
            
            viewerElementPosition.west  +=  westDelta * (viewerElementPosition.east  - viewerElementPosition.west );
            viewerElementPosition.east  +=  eastDelta * (viewerElementPosition.east  - viewerElementPosition.west );
            viewerElementPosition.south += southDelta * (viewerElementPosition.north - viewerElementPosition.south);
            viewerElementPosition.north += northDelta * (viewerElementPosition.north - viewerElementPosition.south);
            
            if (viewerCanvasPosition !== null) {
                setCanvasPosition();
            }
            
            viewChangedCallback(viewerElementPosition, viewerElement.clientWidth, viewerElement.clientHeight);
        }
        
        function buildViewerHtmlElements() {
            viewerElement = document.createElement('td');
            viewerCanvas = document.createElement('canvas');

            var viewerRelativeDiv = document.createElement('div');
            viewerRelativeDiv.appendChild(viewerCanvas);
            viewerElement.appendChild(viewerRelativeDiv);
            viewerRelativeDiv.style.position = 'relative';
            viewerRelativeDiv.style.width = 0;
            viewerRelativeDiv.style.height = 0;
            viewerElement.style.overflow = 'hidden';
            viewerElement.style.width  = '100%';
            viewerElement.style.height = '100%';
            viewerElement.style.textAlign = 'left';
            viewerElement.style.verticalAlign = 'top';
            viewerCanvas.style.position = 'absolute';
            
            var table = document.createElement('table');
            table.style.width  = '100%';
            table.style.height = '100%';
            
            var zoomTr = document.createElement('tr');
            var zoomTd = document.createElement('td');
            zoomTd.appendChild(createMoveButton( 0.1  , -0.1  ,  0.1  , -0.1  , '   +   '));
            zoomTd.appendChild(createMoveButton(-0.125,  0.125, -0.125,  0.125, '   -   '));
            zoomTd.colSpan = 3;
            zoomTr.appendChild(zoomTd);
            table.appendChild(zoomTr);
            
            addRow([null, createButtonTd(0, 0, 0.1,  0.1, '^', '100%', '20px', null, 'bottom'), null]);
            addRow([createButtonTd(-0.1, -0.1, 0, 0, '<', '20px', '100%', 'right'), viewerElement, createButtonTd(0.1, 0.1, 0, 0, '>', '20px', '100%', 'left')]);
            addRow([null, createButtonTd(0, 0, -0.1, -0.1, 'V', '100%', '20px', null, 'top'), null]);

            document.getElementById(divContainerId).appendChild(table);
            
            function createButtonTd(westDelta, eastDelta, southDelta, northDelta, value, width, height, horizontalAlign, verticalAlign) {
                var moveButton;
                moveButton = createMoveButton(westDelta, eastDelta, southDelta, northDelta, value);
                moveButton.style.width  = width ;
                moveButton.style.height = height;
                var td = document.createElement('td');
                td.appendChild(moveButton);
                td.style.textAlign = horizontalAlign || 'center';
                td.style.verticalAlign = verticalAlign || 'middle';
                return td;
            }
            
            function createMoveButton(westDelta, eastDelta, southDelta, northDelta, value) {
                var moveButton = document.createElement('input');
                moveButton.type = 'button';
                moveButton.value = value;
                
                moveButton.addEventListener('click', function() {
                    moveViewer(westDelta, eastDelta, southDelta, northDelta);
                });
                
                return moveButton;
            }
            
            function addRow(elementArray) {
                var tr = document.createElement('tr');
                for (var i = 0; i < elementArray.length; ++i) {
                    var td = elementArray[i];
                    if (!td) {
                        td = document.createElement('td');
                        td.style.textAlign = 'center';
                        td.style.verticalAlign = 'middle';
                    }
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
        }
    },
    
    // Simple AJAX request. You can use AJAX wrapper from your favorite library instead
    ajax: function ajax(url) {
        return new Promise(function(resolve, reject){
            var xhttp = new XMLHttpRequest();
            var finished = false;
            xhttp.onreadystatechange = function() {
                if (xhttp.readyState !== 4 || finished) {
                    return;
                }
                finished = true;
                
                if (xhttp.status !== 200) {
                    reject('Status code ' + xhttp.status);
                    return;
                }
                
                var json = JSON.parse(xhttp.responseText);
                self._imageParams = json;
                resolve(json);
            };
            xhttp.open('GET', url, true);
            xhttp.send();
        });
    }
};