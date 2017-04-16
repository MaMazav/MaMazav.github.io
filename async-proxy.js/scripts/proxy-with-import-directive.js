'use strict';

var ProxyWithImportDirective = asyncProxy.AsyncProxyFactory.create(
	predefinedScriptsToImport.getScriptsForWorkerImport(),
	'CalleeWithImportDirective',
	{ 'helloWorld': [] }
);