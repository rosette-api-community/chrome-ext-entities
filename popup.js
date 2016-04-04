
var requests = []; // queue for XMLHttpRequests to avoid 429 errors from Rosette API

/**
 * Get the current URL.
 *
 * @param {function(string)} callback - called when the URL of the current tab
 *   is found.
 **/
function getCurrentTabUrl(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    // chrome.tabs.query invokes the callback with a list of tabs that match the
    // query. When the popup is opened, there is certainly a window and at least
    // one tab, so we can safely assume that |tabs| is a non-empty array.
    // A window can only have one active tab at a time, so the array consists of
    // exactly one tab.
    var tab = tabs[0];

    // A tab is a plain object that provides information about the tab.
    // See https://developer.chrome.com/extensions/tabs#type-Tab
    var url = tab.url;

    // tab.url is only available if the "activeTab" permission is declared.
    // If you want to see the URL of other tabs (e.g. after removing active:true
    // from |queryInfo|), then the "tabs" permission is required to see their
    // "url" properties.
    console.assert(typeof url == 'string', 'tab.url should be a string');

    callback(url);
  });

  // Most methods of the Chrome extension APIs are asynchronous. This means that
  // you CANNOT do something like this:
  //
  // var url;
  // chrome.tabs.query(queryInfo, function(tabs) {
  //   url = tabs[0].url;
  // });
  // alert(url); // Shows "undefined", because chrome.tabs.query is async.
}

// write statusText to 'status' element in popup.html
function renderStatus(statusText) {
  document.getElementById('status').textContent = statusText;
}

// use Rosette API to get classification of either an entire webpage or of highlighted text
// within that webpage
function getClassification(url, selectedText, callback, errorCallback) {
  var JSONtext; // set text to send to Rosette API
  if (selectedText == "") {
    JSONtext = "{\"contentUri\": \"" + url + "\"}";
  } else {
    JSONtext = "{\"content\": " + JSON.stringify(selectedText) + "}";
  }

  // check for developer key and send requests to Rosette API
  chrome.storage.local.get('rosetteKey', function (result) {
    if (result.rosetteKey == null) {
      renderStatus('Please enter an API key');
      document.getElementsByClassName("bg-info")[0].style.backgroundColor = "#FFCCCC"; // make status box red
    } else {
      var xmlhttp = new XMLHttpRequest();
      var searchUrl = "https://api.rosette.com/rest/v1/categories";
      xmlhttp.open("POST", searchUrl, true);
      xmlhttp.setRequestHeader ("X-RosetteAPI-Key", result.rosetteKey);
      xmlhttp.setRequestHeader ("Accept", "application/json");
      xmlhttp.setRequestHeader ("Content-Type", "application/json");
      xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          var JSONresponse = JSON.parse(this.responseText);
          callback(JSONresponse.categories[0].label);
        } else {
          errorCallback('');
        }
      }
      xmlhttp.onerror = function() {
        errorCallback('Network error.');
      };
      xmlhttp.input = JSONtext;
      // Have the completion of each request trigger the sending of the next one
      // This prevents Rosette API error 429 (Too Many Requests) by only ever letting the extension send one request at a time
      // The onload method is called when the XMLHttpRequest receives any response, even if that response is another
      // Rosette API error, such as 415 (Unsupported Language)
      xmlhttp.onload = function () {
          requests.shift();
          if (requests.length > 0) {
              requests[0].send(requests[0].input);
          } else {
              requests.shift();
          }
      }
      requests.push(xmlhttp);
      
      // send first request, which will trigger the rest through the onload method
      if (requests.length == 1) {
        requests[0].send(requests[0].input);
      }
    }
  });
}

// use Rosette API to get retrieve all entities (people, locations, and organizations)
// from either an entire webpage or from text highlighted by the user
function getEntities(url, selectedText, callback, errorCallback) {
  var JSONtext; // set text to send to Rosette API
  if (selectedText == "") {
    JSONtext = "{\"contentUri\": \"" + url + "\"}";
  } else {
    JSONtext = "{\"content\": " + JSON.stringify(selectedText) + "}";
  }
   
  // check for developer key and send requests to Rosette API
  chrome.storage.local.get('rosetteKey', function (result) {
    if (result.rosetteKey == null) {
      renderStatus('Please enter an API key');
    } else {
      var xmlhttp = new XMLHttpRequest();
      var searchUrl = "https://api.rosette.com/rest/v1/entities";
      xmlhttp.open("POST", searchUrl, true);
      xmlhttp.setRequestHeader ("X-RosetteAPI-Key", result.rosetteKey);
      xmlhttp.setRequestHeader ("Accept", "application/json");
      xmlhttp.setRequestHeader ("Content-Type", "application/json");
      xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          var JSONresponse = JSON.parse(this.responseText);
          callback(JSONresponse.entities);
        } else {
          errorCallback('');
        }
      }
      xmlhttp.input = JSONtext;
      // Have the completion of each request trigger the sending of the next one
      // This prevents Rosette API error 429 (Too Many Requests) by only ever letting the extension send one request at a time
      // The onload method is called when the XMLHttpRequest receives any response, even if that response is another
      // Rosette API error, such as 415 (Unsupported Language)
      xmlhttp.onload = function () {
          requests.shift();
          if (requests.length > 0) {
              requests[0].send(requests[0].input);
          } else {
              requests.shift();
          }
      }
      requests.push(xmlhttp);

      // send first request, which will trigger the rest through the onload method
      if (requests.length == 1) {
          requests[0].send(requests[0].input);
      }
    }
  });
}

// access above functions when popup loads
document.addEventListener('DOMContentLoaded', function() {

  // send message to get selected text via getText.js and store result 
  // in hidden 'stash' element of popup.html
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendMessage(tab.id, {method: "getSelectedText"}, function(response) {
        if(response.method=="getSelectedText"){
            document.getElementById('stash').textContent = response.data;
        }
    });
  });
  
  // call Rosette API on text stored in 'stash' element
  setTimeout(function() {
      getCurrentTabUrl(function(url) {
          var selectedText = document.getElementById('stash').textContent; // access text in 'stash' element
          
          if (selectedText == "") {
              renderStatus('Calling Rosette API on page\n' + url);
          } else {
              renderStatus('Calling Rosette API on selected text');
          }

          // get classification of selected text from Rosette API and display result in 'catResult' element
          getClassification(url, selectedText, function(classification) {
              document.getElementById('catStatus').textContent = "Rosette classification result:";
              var result = document.getElementById('catResult');
              result.innerText = classification

          }, function(errorMessage) { // error callback
              document.getElementById('catStatus').textContent = "No classification result. " + errorMessage;
          });

          // get entities of selected text from Rosette API and display result in 'locs', 'pers', and 'orgs' elements
          getEntities(url, selectedText, function(entities) {
              document.getElementById('entityStatus').textContent = "Rosette entity extraction results:";
              var locs = document.getElementById('locs');
              var pers = document.getElementById('pers');
              var orgs = document.getElementById('orgs');
    
              for (var i in entities) {
                  if (entities[i].type == "LOCATION") {
                      var li = document.createElement("li");
                      li.innerHTML = entities[i].mention;
                      locs.appendChild(li);
                  } else if (entities[i].type == "PERSON") {
                      var li = document.createElement("li");
                      li.innerHTML = entities[i].mention;
                      pers.appendChild(li);
                  } else if (entities[i].type == "ORGANIZATION") {
                      var li = document.createElement("li");
                      li.innerHTML = entities[i].mention;
                      orgs.appendChild(li);
                  }
              }
    
          }, function(errorMessage) { // error callback
              document.getElementById('entityStatus').textContent = "No entity extraction results. " + errorMessage;
          });
      });
  }, 500);
});

// NOTE: The content_fb.js file in the chrome-ext-Sentiment repo contains
// the most elegant structure for sending non-concurrent XMLHttpRequests (to avoid 429 errors)
// out of all the Chrome extension examples.
