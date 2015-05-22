hljs.initHighlightingOnLoad();

$('code').each(function() {
	var url = this.getAttribute('data-src');
    if (url) {
        $(this).load(url);
    }
});