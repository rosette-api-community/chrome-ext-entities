"use strict";

var Api = require("rosette-api");

var api = new Api('7323bf299f9f593cb1d7e267e5bdc34a');
var endpoint = "ping";

api.rosette(endpoint, function(err, res){
	if(err){
		console.log(err)
	} else {
		console.log(JSON.stringify(res, null, 2));
	}
});