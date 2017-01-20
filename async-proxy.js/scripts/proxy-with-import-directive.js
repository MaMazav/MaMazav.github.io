'use strict';

var ProxyWithImportDirective = AsyncProxy.AsyncProxyFactory.create(
	predefinedScriptsToImport.getScriptsForWorkerImport(),
	'CalleeWithImportDirective',
	{ 'helloWorld': [] }
);