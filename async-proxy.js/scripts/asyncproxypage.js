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