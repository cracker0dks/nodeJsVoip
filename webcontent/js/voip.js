// Initialize Socket.IO with reconnection configuration
var socketIO = io({
	reconnection: VoipConfig.network.reconnection,
	reconnectionAttempts: VoipConfig.network.reconnectionAttempts,
	reconnectionDelay: VoipConfig.network.reconnectionDelay,
	reconnectionDelayMax: VoipConfig.network.reconnectionDelayMax,
	timeout: VoipConfig.network.timeout
});

var soundcardSampleRate = null; //Sample rate from the soundcard (is set at mic access)
var mySampleRate = VoipConfig.audio.sampleRate; //Samplerate outgoing audio
var myBitRate = VoipConfig.audio.bitRate; //8,16,32 - outgoing bitrate
var myMinGain = VoipConfig.audio.minGain; //min Audiolvl
var micAccessAllowed = false; //Is set to true if user granted access
var chunkSize = VoipConfig.audio.chunkSize;
var isMicMuted = false; //Mute state

var downSampleWorker = new Worker('./js/voipWorker.js');
var upSampleWorker = new Worker('./js/voipWorker.js');

var socketConnected = false; //is true if client is connected
var steamBuffer = {}; //Buffers incomeing audio

var oscillator;

function hasGetUserMedia() {
	return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Room management functions
function joinRoom(roomName) {
	socketIO.emit('join-room', roomName);
}

function leaveRoom() {
	socketIO.emit('leave-room');
}

socketIO.on('connect', function (socket) {
	console.log('socket connected!');
	socketConnected = true;
	if (window.onConnectionStatusChange) {
		window.onConnectionStatusChange('connected', 'Connected');
	}

	socketIO.on('d', function (data) {
		if (micAccessAllowed) {
			var audioData = onUserCompressedAudio(data["a"], data["sid"], data["s"], data["b"]);
			upSampleWorker.postMessage({
				"inc": true,
				"inDataArrayBuffer": audioData, //Audio data
				"outSampleRate": soundcardSampleRate,
				"outChunkSize": chunkSize,
				"socketId": data["sid"],
				"inSampleRate": data["s"],
				"inBitRate": data["b"],
				"p": data["p"]
			});
		}
	});

	// Room event handlers
	socketIO.on('room-joined', function (data) {
		if (window.onRoomJoined) window.onRoomJoined(data);
	});

	socketIO.on('room-left', function () {
		if (window.onRoomLeft) window.onRoomLeft();
	});

	socketIO.on('user-joined', function (data) {
		if (window.onUserJoined) window.onUserJoined(data);
	});

	socketIO.on('user-left', function (data) {
		if (window.onUserLeft) window.onUserLeft(data);
	});

	socketIO.on('rooms-list', function (rooms) {
		if (window.onRoomsList) window.onRoomsList(rooms);
	});
});

socketIO.on('disconnect', function (reason) {
	console.log('Socket disconnected. Reason:', reason);
	socketConnected = false;
	if (window.onConnectionStatusChange) {
		window.onConnectionStatusChange('disconnected', reason);
	}
});

// Reconnection event handlers
socketIO.on('connect_error', function (error) {
	console.error('Connection error:', error.message);
	if (window.onConnectionStatusChange) {
		window.onConnectionStatusChange('error', 'Connection error: ' + error.message);
	}
});

socketIO.on('reconnect_attempt', function (attemptNumber) {
	console.log('Reconnection attempt:', attemptNumber);
	if (window.onConnectionStatusChange) {
		window.onConnectionStatusChange('reconnecting', 'Attempt ' + attemptNumber);
	}
});

socketIO.on('reconnect', function (attemptNumber) {
	console.log('Reconnected successfully after', attemptNumber, 'attempts');
	socketConnected = true;
	if (window.onConnectionStatusChange) {
		window.onConnectionStatusChange('connected', 'Reconnected');
	}
});

socketIO.on('reconnect_error', function (error) {
	console.error('Reconnection error:', error.message);
});

socketIO.on('reconnect_failed', function () {
	console.error('Reconnection failed after all attempts');
	if (window.onConnectionStatusChange) {
		window.onConnectionStatusChange('failed', 'Could not reconnect');
	}
});

// Handle server shutdown
socketIO.on('server-shutdown', function (data) {
	console.warn('Server is shutting down:', data.message);
	if (window.onConnectionStatusChange) {
		window.onConnectionStatusChange('shutdown', data.message);
	}
});

downSampleWorker.addEventListener('message', function (e) {
	if (socketConnected && !isMicMuted) {
		var data = e.data;
		var audioData = onMicCompressedAudio(data[0].buffer, mySampleRate, myBitRate)
		socketIO.emit("d",
			{
				"a": audioData, //Audio data
				"s": mySampleRate,
				"b": myBitRate,
				"p": data[1]
			});
	}
}, false);

upSampleWorker.addEventListener('message', function (e) {
	var data = e.data;
	var clientId = data[0];
	var voiceData = onUserDecompressedAudio(data[1], clientId, soundcardSampleRate);
	if (typeof (steamBuffer[clientId]) === "undefined") {
		steamBuffer[clientId] = [];
	}
	if (steamBuffer[clientId].length > 5)
		steamBuffer[clientId].splice(0, 1); //If to much audio is inc for some reason... remove

	steamBuffer[clientId].push(voiceData);
}, false);

function startTalking() {
	if (hasGetUserMedia()) {
		var context = new (window.AudioContext || window.webkitAudioContext)();
		soundcardSampleRate = context.sampleRate;

		// Configure audio constraints with enhancements
		var audioConstraints = {
			audio: {
				echoCancellation: VoipConfig.enhancements.echoCancellation.enabled &&
				                  VoipConfig.enhancements.echoCancellation.useBrowserAEC,
				noiseSuppression: VoipConfig.enhancements.noiseSuppression.enabled,
				autoGainControl: VoipConfig.enhancements.autoGainControl.enabled,
				sampleRate: { ideal: soundcardSampleRate },
				channelCount: { ideal: 1 }
			}
		};

		console.log('Audio constraints:', audioConstraints);

		navigator.mediaDevices.getUserMedia(audioConstraints).then(function (stream) {
			micAccessAllowed = true;
			var liveSource = context.createMediaStreamSource(stream);

			oscillator = context.createOscillator();
			oscillator.type = 'sine';
			oscillator.frequency.value = 440; // value in hertz

			// create a ScriptProcessorNode
			// TODO: Migrate to AudioWorklet in the future (ScriptProcessorNode is deprecated but still functional)
			if (!context.createScriptProcessor) {
				node = context.createJavaScriptNode(chunkSize, 1, 1);
			} else {
				node = context.createScriptProcessor(chunkSize, 1, 1);
			}

			node.onaudioprocess = function (e) {
				var inData = e.inputBuffer.getChannelData(0);
				var outData = e.outputBuffer.getChannelData(0);

				inData = onMicRawAudio(inData, soundcardSampleRate); //API Function to change audio data

				downSampleWorker.postMessage({ //Downsample client mic data
					"inc": false, //its audio from the client so false
					"inDataArrayBuffer": inData,
					"inSampleRate": soundcardSampleRate,
					"outSampleRate": mySampleRate,
					"outBitRate": myBitRate,
					"minGain": myMinGain,
					"outChunkSize": chunkSize,
					"vadConfig": VoipConfig.enhancements.vad,
					"noiseConfig": VoipConfig.enhancements.noiseSuppression
				});

				var allSilence = true;
				for (var c in steamBuffer) {
					if (steamBuffer[c].length !== 0) {
						allSilence = false;
						break;
					}
				}
				if (allSilence) {
					for (var i in inData) {
						outData[i] = 0;
					}
				} else {
					var div = false; //true if its not the first audio stream
					for (var c in steamBuffer) {
						if (steamBuffer[c].length != 0) {
							for (var i in steamBuffer[c][0]) {
								if (div)
									outData[i] = (outData[i] + steamBuffer[c][0][i]) / 2; //need to muxing audio
								else
									outData[i] = steamBuffer[c][0][i];
							}
							steamBuffer[c].splice(0, 1); //remove the audio after putting it in buffer
							div = true;
						}
					}
				}
			}

			//Lowpass
			biquadFilter = context.createBiquadFilter();
			biquadFilter.type = "lowpass";
			biquadFilter.frequency.value = VoipConfig.processing.lowPassFrequency;

			oscillator.connect(biquadFilter);
			//oscillator.start();

			liveSource.connect(biquadFilter);




			//Dynamic Compression
			dynCompressor = context.createDynamicsCompressor();
			dynCompressor.threshold.value = VoipConfig.processing.compression.threshold;
			dynCompressor.knee.value = VoipConfig.processing.compression.knee;
			dynCompressor.ratio.value = VoipConfig.processing.compression.ratio;
			dynCompressor.reduction.value = VoipConfig.processing.compression.reduction;
			dynCompressor.attack.value = VoipConfig.processing.compression.attack;
			dynCompressor.release.value = VoipConfig.processing.compression.release;

			biquadFilter.connect(dynCompressor); //biquadFilter infront
			dynCompressor.connect(node);

			node.connect(context.destination);
		}).catch(function (err) {
			console.error('Error accessing microphone:', err);

			var errorMessage = 'Could not access your microphone. ';

			// Provide specific error messages based on error type
			if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
				errorMessage += 'You denied microphone access. Please allow microphone access in your browser settings and try again.';
			} else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
				errorMessage += 'No microphone found. Please connect a microphone and try again.';
			} else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
				errorMessage += 'Your microphone is already in use by another application. Please close other applications using the microphone and try again.';
			} else if (err.name === 'OverconstrainedError') {
				errorMessage += 'No microphone matching the requirements was found.';
			} else if (err.name === 'TypeError') {
				errorMessage += 'There was an error with the microphone configuration.';
			} else {
				errorMessage += err.message;
			}

			alert(errorMessage);

			// Show error in status message
			if (window.onMicrophoneError) {
				window.onMicrophoneError(errorMessage);
			}
		});
	} else {
		var message = 'Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Edge.';
		alert(message);
		if (window.onMicrophoneError) {
			window.onMicrophoneError(message);
		}
	}
}

/* API FUNCTIONS */

var onMicRawAudio = function (audioData, soundcardSampleRate) { //Data right after mic input
	return audioData;
}

var onMicCompressedAudio = function (audioData, sampleRate, bitRate) { //Mic data after changeing bit / samplerate
	return audioData;
}

var onUserCompressedAudio = function (audioData, userId, sampleRate, bitRate) { //Called when user audiodata coming from the client
	return audioData;
}

var onUserDecompressedAudio = function (audioData, userId, sampleRate) { //Called when user audiodata coming from the client
	return audioData;
}

// Mute/Unmute functionality
function toggleMute(muted) {
	isMicMuted = muted;
	console.log('Microphone ' + (muted ? 'muted' : 'unmuted'));
}