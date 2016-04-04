// When chrome sends a message asking for the "getSelectedText" method, send a
// response that is the selected text.
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.method == "getSelectedText"){
            var text = "";
            if (window.getSelection) {
                text = window.getSelection().toString();
            } else if (document.selection && document.selection.type != "Control") {
                text = document.selection.createRange().text;
            }
            sendResponse({data: text, method: "getSelectedText"});
        }
    }
);