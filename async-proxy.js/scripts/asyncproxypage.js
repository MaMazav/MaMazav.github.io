'use strict';

var AsyncProxyHelloWorldForDemo = AsyncProxyHelloWorld;
var AsyncProxyHelloWorldToggle = AsyncProxyHelloWorldCustom;

var AsyncProxyMethodsForDemo = AsyncProxyMethods;
var AsyncProxyMethodsToggle = AsyncProxyMethodsCustom;

function toggleDemoCustom() {
	var tmp = AsyncProxyHelloWorldForDemo;
	AsyncProxyHelloWorldForDemo = AsyncProxyHelloWorldToggle;
	AsyncProxyHelloWorldToggle = tmp;
	
	tmp = AsyncProxyMethodsForDemo;
	AsyncProxyMethodsForDemo = AsyncProxyMethodsToggle;
	AsyncProxyMethodsToggle = tmp;
}

function demoHelloWorld() {
	var proxy = new AsyncProxyHelloWorldForDemo({ helloWorldCtorArgument: 10000 });
	proxy.helloWorld(50000);
}

function demoSubWorker() {
	var proxy = new SubWorkerProxy();
	proxy.callSubWorker(/*depth=*/3);
}

function demoMethods() {
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

function demoCustomCallback() {
	var proxy = new CustomCallbackProxy();
	proxy.returnArrayBufferByCallbackMultipleTimes(function(result) {
		alert('Callback message: ' + result.message);
	});
}

function demoTerminate() {
	var proxy = new TerminateProxy();
	proxy.callSubWorker(/*depth=*/3);
    
    proxy.releaseResources();
}

function demoTransferablesFromCallback() {
	var proxy = new TransferablesFromCallback();
    
    proxy.returnArrayBufferByCallback(function() { });
}

function demoCustomCreation() {
    var proxy = new CustomCreationProxy(5);
    
    proxy.someFunction(7).then(function(result) {
        alert('Function returned ' + result);
    });
}

function demoUserData() {
    var proxy = new UserDataMaster();
}

function demoSetBeforeOperationListener() {
    var proxy = new BeforeOperationListener();
    proxy.asyncFunctionWithCallback(function callback() { });
}

function demoScriptsToImportPool() {
	var proxy = new ProxyWithImportDirective({ helloWorldCtorArgument: 10000 });
	proxy.helloWorld(50000);
}