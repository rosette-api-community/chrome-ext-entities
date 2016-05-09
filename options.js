// Saves options to chrome.storage.local.

function saveKey() {
	chrome.storage.local.get('rosetteKey', function(result){
		if(result.rosetteKey != undefined)
        document.getElementById('user-key').value = result.rosetteKey;
	});
}

window.onload = saveKey();

function handleOptions() {
  var entryField = document.getElementById('user-key');
  chrome.storage.local.set({'rosetteKey': entryField.value}, function() {
    // Notify user settings were saved
  	document.getElementById('save-message').style.visibility = "visible";
    document.getElementById('save-message').innerHTML = "Settings successfully updated.";
  });
}
// add above function to Save button
document.getElementById('save').addEventListener('click', handleOptions);