// Don't re-instantiate if already instantiated in other file.
// That way you can import some files in slave
var predefinedScriptsToImport = predefinedScriptsToImport || new AsyncProxy.ScriptsToImportPool();
predefinedScriptsToImport.addScriptFromErrorWithStackTrace(new Error());

var CalleeWithImportDirective = (function CalleeWithImportDirectiveClosure() {
    function CalleeWithImportDirective(ctorArgument) {
        this._ctorArgument = ctorArgument;
    }
    
    CalleeWithImportDirective.prototype.helloWorld = function helloWorld(functionArgument) {
        console.log('Started CalleeWithImportDirective.helloWorld()...');
        
        var numIterations = this._ctorArgument.helloWorldCtorArgument * functionArgument;
        for (var i = 2; i < numIterations; ++i) {
            var x = Math.log(i);
            ++x;
        }
        
        console.log('Performed ' + numIterations + ' iterations in CalleeWithImportDirective.helloWorld()');
    };
    
    return CalleeWithImportDirective;
})();