// Load environment variables from .env file
require('dotenv').config();

/* CONFIG - All values can be overridden with environment variables */
var SSLPORT = process.env.SSL_PORT || 443; //Default 443
var HTTPPORT = process.env.HTTP_PORT || 80; //Default 80 (Only used to redirect to SSL port)
var privateKeyPath = process.env.PRIVATE_KEY_PATH || "./cert/key.pem"; //Default "./cert/key.pem"
var certificatePath = process.env.CERTIFICATE_PATH || "./cert/cert.pem"; //Default "./cert/cert.pem"
var corsOrigin = process.env.CORS_ORIGIN || "*"; //Default allow all origins
var pingTimeout = parseInt(process.env.PING_TIMEOUT) || 60000; //Default 60 seconds
var pingInterval = parseInt(process.env.PING_INTERVAL) || 25000; //Default 25 seconds
var nodeEnv = process.env.NODE_ENV || 'production';
var debug = process.env.DEBUG === 'true';

// Log configuration on startup
if (debug) {
	console.log('Configuration:');
	console.log('  SSL_PORT:', SSLPORT);
	console.log('  HTTP_PORT:', HTTPPORT);
	console.log('  PRIVATE_KEY_PATH:', privateKeyPath);
	console.log('  CERTIFICATE_PATH:', certificatePath);
	console.log('  CORS_ORIGIN:', corsOrigin);
	console.log('  NODE_ENV:', nodeEnv);
}

/* END CONFIG */

var fs = require('fs');
var express = require('express');
var https = require('https');
var http = require('http');
var app = express();

app.use(express.static(__dirname + '/webcontent'));

// SSL Certificate loading with error handling
var privateKey, certificate, server, httpsServer;

try {
	privateKey = fs.readFileSync(privateKeyPath);
	certificate = fs.readFileSync(certificatePath);
	console.log("SSL certificates loaded successfully");

	httpsServer = https.createServer({
		key: privateKey,
		cert: certificate
	}, app);

	httpsServer.on('error', function(err) {
		console.error("HTTPS Server Error:", err.message);
		if (err.code === 'EADDRINUSE') {
			console.error("Port " + SSLPORT + " is already in use. Please stop the other process or change the port.");
		}
		process.exit(1);
	});

	server = httpsServer.listen(SSLPORT, function() {
		console.log("HTTPS Server listening on port: " + SSLPORT);
	});

} catch (err) {
	console.error("Failed to load SSL certificates:", err.message);
	console.error("Please ensure certificates exist at:");
	console.error("  - Private Key: " + privateKeyPath);
	console.error("  - Certificate: " + certificatePath);
	console.error("\nYou can generate self-signed certificates with:");
	console.error("  openssl req -nodes -new -x509 -keyout cert/key.pem -out cert/cert.pem -days 365");
	process.exit(1);
}

var io  = require('socket.io')(server, {
    cors: {
        origin: corsOrigin,
        methods: ["GET", "POST"]
    },
    pingTimeout: pingTimeout,
    pingInterval: pingInterval
});

// Redirect from http to https with error handling
var httpServer = http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + ":"+ SSLPORT + "" + req.url });
    res.end();
});

httpServer.on('error', function(err) {
	console.error("HTTP Server Error:", err.message);
	if (err.code === 'EADDRINUSE') {
		console.error("Port " + HTTPPORT + " is already in use. Please stop the other process or change the port.");
	}
});

httpServer.listen(HTTPPORT, function() {
	console.log("HTTP redirect server listening on port: " + HTTPPORT);
});

console.log("Webserver & Socketserver running successfully");
console.log("HTTPS on port: " + SSLPORT + ", HTTP redirect on port: " + HTTPPORT);

// Room management
var rooms = {}; // { roomName: { users: [socketId1, socketId2, ...], created: timestamp } }

// Helper function to get room users count
function getRoomUsersCount(roomName) {
	return rooms[roomName] ? rooms[roomName].users.length : 0;
}

// Helper function to get all rooms info
function getRoomsInfo() {
	var roomsInfo = {};
	for (var roomName in rooms) {
		roomsInfo[roomName] = {
			users: rooms[roomName].users.length,
			created: rooms[roomName].created
		};
	}
	return roomsInfo;
}

//Handle connections with error handling
io.sockets.on('connection', function (socket) {
	console.log("New user connected:", socket.id);
	socket.currentRoom = null; // Track current room

	// Handle connection errors
	socket.on('error', function(err) {
		console.error("Socket error for user", socket.id, ":", err.message);
	});

	// Send list of available rooms on connection
	socket.emit('rooms-list', getRoomsInfo());

	// Handle room join
	socket.on('join-room', function (roomName) {
		// Leave current room if in one
		if (socket.currentRoom) {
			socket.leave(socket.currentRoom);
			if (rooms[socket.currentRoom]) {
				var index = rooms[socket.currentRoom].users.indexOf(socket.id);
				if (index > -1) {
					rooms[socket.currentRoom].users.splice(index, 1);
				}
				// Delete room if empty
				if (rooms[socket.currentRoom].users.length === 0) {
					delete rooms[socket.currentRoom];
					console.log("Room deleted:", socket.currentRoom);
				}
			}
			// Notify others in old room
			io.to(socket.currentRoom).emit('user-left', {
				userId: socket.id,
				room: socket.currentRoom,
				usersCount: getRoomUsersCount(socket.currentRoom)
			});
		}

		// Create room if it doesn't exist
		if (!rooms[roomName]) {
			rooms[roomName] = {
				users: [],
				created: Date.now()
			};
			console.log("Room created:", roomName);
		}

		// Join the room
		socket.join(roomName);
		socket.currentRoom = roomName;
		rooms[roomName].users.push(socket.id);

		console.log("User", socket.id, "joined room:", roomName);

		// Notify user of successful join
		socket.emit('room-joined', {
			room: roomName,
			usersCount: rooms[roomName].users.length
		});

		// Notify others in the room
		socket.to(roomName).emit('user-joined', {
			userId: socket.id,
			room: roomName,
			usersCount: rooms[roomName].users.length
		});

		// Send updated rooms list to all clients
		io.emit('rooms-list', getRoomsInfo());
	});

	// Handle leaving room
	socket.on('leave-room', function () {
		if (socket.currentRoom) {
			var roomName = socket.currentRoom;
			socket.leave(roomName);

			if (rooms[roomName]) {
				var index = rooms[roomName].users.indexOf(socket.id);
				if (index > -1) {
					rooms[roomName].users.splice(index, 1);
				}
				// Delete room if empty
				if (rooms[roomName].users.length === 0) {
					delete rooms[roomName];
					console.log("Room deleted:", roomName);
				}
			}

			// Notify others in room
			io.to(roomName).emit('user-left', {
				userId: socket.id,
				room: roomName,
				usersCount: getRoomUsersCount(roomName)
			});

			socket.currentRoom = null;
			socket.emit('room-left');

			// Send updated rooms list to all clients
			io.emit('rooms-list', getRoomsInfo());
		}
	});

	socket.on('disconnect', function () {
		console.log("User disconnected:", socket.id);

		// Remove from room if in one
		if (socket.currentRoom) {
			var roomName = socket.currentRoom;
			if (rooms[roomName]) {
				var index = rooms[roomName].users.indexOf(socket.id);
				if (index > -1) {
					rooms[roomName].users.splice(index, 1);
				}
				// Delete room if empty
				if (rooms[roomName].users.length === 0) {
					delete rooms[roomName];
					console.log("Room deleted:", roomName);
				}
			}
			// Notify others in room
			io.to(roomName).emit('user-left', {
				userId: socket.id,
				room: roomName,
				usersCount: getRoomUsersCount(roomName)
			});
		}

		// Send updated rooms list to all clients
		io.emit('rooms-list', getRoomsInfo());
	});

	// Handle audio data - only send to users in the same room
	socket.on('d', function (data) {
		if (socket.currentRoom) {
			data["sid"] = socket.id;
			// Send only to users in the same room
			socket.to(socket.currentRoom).emit('d', data);
		}
	});
});

// Graceful shutdown handling
function gracefulShutdown() {
	console.log("\nReceived shutdown signal, closing connections gracefully...");

	// Notify all connected clients
	io.emit('server-shutdown', { message: 'Server is shutting down' });

	// Close socket.io connections
	io.close(function() {
		console.log("Socket.IO connections closed");

		// Close HTTPS server
		if (server) {
			server.close(function() {
				console.log("HTTPS server closed");
				process.exit(0);
			});
		}

		// Force close after 10 seconds
		setTimeout(function() {
			console.error("Could not close connections in time, forcefully shutting down");
			process.exit(1);
		}, 10000);
	});
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', function(err) {
	console.error("Uncaught Exception:", err);
	console.error(err.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', function(reason, promise) {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
});