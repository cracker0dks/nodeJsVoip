var thePort = 9002;
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: thePort});
var clientIds = [];
for(var i=0;i<255;i++) {
	clientIds.push(i);
}

var clients = [];
var channelList = {
	"id" : 0,
	"zindex" : 0,
	"name" : "root",
	"subchannels" : []
}
wss.on('connection', function(ws) {
	var client = {
				"i" :  {
					"clientId" : clientIds[0],
					"ci" : 0, 	//channel id
					"pl" : 0,	//Permission level
					"pp" : null, //Profil Pic
					"nn" : "user"+clients.length //Nickname
				},
				"ws" : ws
			};
	clients.push(client);
	console.log(client["i"]["clientId"], "connected! ClientCount:"+clients.length);
	clientIds.splice(0,1);
	sendClientInfoList();
		
    ws.on('message', function(message) {
		//console.log(message);
		if(typeof(message)==="object") {
			var data = addClientInformation(message, client["i"]["clientId"]);			
			//console.log("-e", data);
			wss.sendToChannel(client["i"]["clientId"],client["i"]["ci"], data);
		} else {
			//String incoming
			console.log("inc",client["i"]["clientId"], message);
			var msgs = message.split("###");
			switch(msgs[0]) {
				case "client": 
					client["i"][msgs[1]] = msgs[2];
					sendClientInfoList();
					break;
				case "chat":
					wss.broadcast(client["i"]["clientId"], "chat###"+client["i"].nn+"###"+msgs[1]);
					break;
			}
		}
    });
	
	ws.on("close", function() {
		client.ws = null;
		console.log("kill", client["i"]["clientId"]);
		for(var i=0; i<clients.length;i++) {
			if(clients[i]["i"]["clientId"] == client["i"]["clientId"]) {
				clients.splice(i,1);
				clientIds.push(client["i"]["clientId"]);
				break;
			}
		}
		console.log('Subscriber left: ' + clients.length + " total.\n");
		sendClientInfoList();
	});

	ws.on('error', function(reason, code) {
	    console.log('socket error: reason ' + reason + ', code ' + code);
	});
});

wss.broadcast = function(clientId, data) { //Send all but not the client the message was from
    for(var i =0;i<clients.length;i++) {
		if(clientId != clients[i].i.clientId) {
			try {
				clients[i]["ws"].send(data);
			} catch(e) {
				console.log("client already closed!");
			}
		}
	}
};

wss.sendAll = function(data) {
	for(var i =0;i<clients.length;i++) {
		try {
			clients[i]["ws"].send(data);
		} catch(e) {
			console.log("client already closed!");
		}
	}
}

wss.sendToChannel = function(clientId, channelId, data) {
    for(var i =0;i<clients.length;i++) {
		if(clientId != clients[i]["i"]["clientId"] && clients[i]["i"]["ci"]==channelId){
			try {
				clients[i]["ws"].send(data);
			} catch(e) {
				console.log("client already closed!");
			}
		}
	}
};


console.log("Running on Port:"+thePort);

/*---------------------------------------------------
		--- Add client information to audio datas ---
---------------------------------------------------*/

function sendClientInfoList() {
	var sendObject = [];
	for(var i=0;i<clients.length;i++) {
		sendObject.push(clients[i].i);
	}
	wss.sendAll("clientlist###"+JSON.stringify(sendObject));
}

function addClientInformation(data, clientId){
	var buff = new ArrayBuffer(data.length+1);
	var newView = new Uint8Array(buff);
	var oldView = new Uint8Array(data);
	var i=0;
	for(i = 0;i<oldView.length;i++){
	    newView[i] = oldView[i];
	}
	newView[i++] = clientId;
	return new Buffer(newView);
}