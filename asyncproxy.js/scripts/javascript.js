'use strict';

hljs.initHighlightingOnLoad();

$('code').each(function() {
	var url = this.getAttribute('data-src');
    if (url) {
        $(this).load(url);
    }
});

function demoHelloWorld() {
	var proxy = new AsyncProxyHelloWorld({ helloWorldCtorArgument: 10000 });
	proxy.helloWorld(50000);
}

function demoSubWorker() {
	var proxy = new SubWorkerProxy();
	proxy.callSubWorker(/*depth=*/3);
}

function demoPromise() {
	var proxy = new PromiseProxy();
	proxy.asyncFunction().then(function(result) {
		alert('Promise returned ' + result + '!');
	});
}

function demoCallback() {
	var proxy = new CallbackProxy();
	proxy.asyncFunctionWithCallback(function(result) {
		alert('Callback returned ' + result);
	});
}

function demoMultipleCallback() {
	var proxy = new MultipleCallbackProxy();
	proxy.asyncFunctionWithCallbackMultiple(function(result) {
		alert('Callback message: ' + result.message);
	});
}

function demoTerminate() {
	var proxy = new TerminateProxy();
	proxy.callSubWorker(/*depth=*/3);
    
    proxy.releaseResources();
}

function demoTransferablesToWorker() {
	var proxy = new TransferablesToWorker();
    
    var array = new Uint8Array(2);
    array[0] = 50;
    array[1] = 77;
	
    proxy.passArrayBuffer(array);
}

function demoTransferablesFromPromise() {
	var proxy = new TransferablesFromPromise();
    
    var array = new Uint8Array(2);
    array[0] = 43;
    array[1] = 61;
	
    proxy.passArrayBuffer(array);
}

function demoTransferablesFromCallback() {
	var proxy = new TransferablesFromCallback();
    
    proxy.returnArrayBufferByCallback(function() { });
}