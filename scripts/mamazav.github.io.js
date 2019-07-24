var waitingToLoadElements = 0;

var codeElements = document.getElementsByTagName('code');
for (var i = 0; i < codeElements.length; ++i) {
    var url = codeElements[i].getAttribute('data-src');
    if (url) {
        ++waitingToLoadElements;
        if (url.endsWith('.js')) {
            codeElements[i].className = 'language-js';
        }
        loadCode(codeElements[i], url);
    }
}

function loadCode(el, url) {
    var ajaxResponse = new XMLHttpRequest();
    ajaxResponse.open('GET', url, true);
    ajaxResponse.onreadystatechange = internalAjaxCallback;
    ajaxResponse.send(null);

    var isFinishedRequest = false;
    
    function internalAjaxCallback(e) {
        if (isFinishedRequest || ajaxResponse.readyState !== 4) {
            return;
        }

        isFinishedRequest = true;
        --waitingToLoadElements;
        
        if (ajaxResponse.status === 200 && ajaxResponse.response !== null) {
            el.innerHTML = ajaxResponse.response;
        }
        
        if (waitingToLoadElements <= 0) {
            Prism.highlightAll();
        }
    }
}