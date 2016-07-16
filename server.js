/* CONFIG */
var SSLPORT = 443; //Default 443
var HTTPPORT = 80; //Default 80 (Only used to redirect to SSL port)
var privateKeyPath = "./cert/key.pem"; //Default "./cert/key.pem"
var certificatePath = "./cert/cert.pem"; //Default "./cert/cert.pem"

/* END CONFIG */

var fs = require('fs');
var express = require('express');
var https = require('https');
var app = express();

app.use(function(req, res, next) {
    "use strict";
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
    res.header('Access-Control-Allow-Headers', 'origin, content-type', 'X-Requested-With');
    if (req.method == 'OPTIONS') {
        res.send(200);
    } else {
        next();
    }
});

app.use(express.static(__dirname + '/webcontent'));

var privateKey = fs.readFileSync( privateKeyPath );
var certificate = fs.readFileSync( certificatePath );

var server = https.createServer({
    key: privateKey,
    cert: certificate
}, app).listen(SSLPORT);

var io  = require('socket.io').listen(server, { log: false });

// Redirect from http to https
var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + ":"+ SSLPORT + "" + req.url });
    res.end();
}).listen(HTTPPORT);

console.log("Webserver & Socketserver running on port: "+SSLPORT+ " and "+ HTTPPORT);

//Handel connections
io.sockets.on('connection', function (socket) {
	console.log("New user connected:", socket.id);

	socket.on('disconnect', function () {
		console.log("User disconnected:", socket.id);
	});

	socket.on('d', function (data) {
		var newData = {
			"sid" : socket.id,
			"a" : data //Audio data
		}
		socket.broadcast.emit('d', newData);
	});
});