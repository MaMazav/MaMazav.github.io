function demoArguments() {
	var proxy = new AsyncProxyMethodsForDemo();
	alert('Calling promise function...');
	proxy.asyncFunction().then(function(result) {
		alert('Promise returned ' + result + '! Press OK to call callback function...');
		proxy.asyncFunctionWithCallback(function(result) {
			alert('Callback returned ' + result + '! Press OK to call methods with transferable...');

			var array = new Uint8Array(2);
			array[0] = 50;
			array[1] = 77;
			
			proxy.passArrayBuffer(array).then(function(result) {
				var passedArray = result.someProperty;
				console.log('Array is accessible again on main thread, first value is ' + passedArray[0]);
				setTimeout(function() {
					alert('Transferables demo is over. See console log');
				}, 10); // Let worker to finish printing to console
			});
		});
	});
}