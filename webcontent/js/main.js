document.addEventListener('DOMContentLoaded', function () {
	// Display current configuration
	document.getElementById("sampleRate").textContent = VoipConfig.audio.sampleRate;
	document.getElementById("bitRate").textContent = VoipConfig.audio.bitRate;
	document.getElementById("chunkSize").textContent = VoipConfig.audio.chunkSize;

	// Connection status indicator
	var connectionStatus = document.getElementById("connectionStatus");

	// Handle connection status changes
	window.onConnectionStatusChange = function (status, message) {
		var statusText = '';
		var bgColor = '';
		var textColor = 'white';

		switch (status) {
			case 'connected':
				statusText = '● Connected';
				bgColor = '#28a745'; // Green
				break;
			case 'disconnected':
				statusText = '● Disconnected';
				bgColor = '#ffc107'; // Yellow
				textColor = 'black';
				break;
			case 'reconnecting':
				statusText = '● Reconnecting... (' + message + ')';
				bgColor = '#ff9800'; // Orange
				break;
			case 'error':
				statusText = '● Error';
				bgColor = '#dc3545'; // Red
				break;
			case 'failed':
				statusText = '● Connection Failed';
				bgColor = '#dc3545'; // Red
				break;
			case 'shutdown':
				statusText = '● Server Shutdown';
				bgColor = '#6c757d'; // Gray
				break;
			default:
				statusText = '● ' + status;
				bgColor = '#6c757d'; // Gray
		}

		connectionStatus.textContent = statusText;
		connectionStatus.style.background = bgColor;
		connectionStatus.style.color = textColor;

		// Show notification for critical statuses
		if (status === 'failed' || status === 'shutdown' || status === 'error') {
			statusMessage.textContent = '⚠️ ' + message;
			statusMessage.style.color = '#dc3545';
		} else if (status === 'connected' && message === 'Reconnected') {
			statusMessage.textContent = '✅ Connection restored!';
			statusMessage.style.color = '#28a745';
			// Clear message after 5 seconds
			setTimeout(function () {
				statusMessage.textContent = '';
			}, 5000);
		}
	};

	// Handle microphone errors
	window.onMicrophoneError = function (errorMessage) {
		statusMessage.textContent = '⚠️ ' + errorMessage;
		statusMessage.style.color = '#dc3545';
		// Re-show start button so user can try again
		document.getElementById("startBtn").style.display = 'inline-block';
	};

	// Room management UI
	var currentRoom = null;
	var roomNameInput = document.getElementById("roomName");
	var joinRoomBtn = document.getElementById("joinRoomBtn");
	var leaveRoomBtn = document.getElementById("leaveRoomBtn");
	var currentRoomInfo = document.getElementById("currentRoomInfo");
	var currentRoomName = document.getElementById("currentRoomName");
	var roomUsersCount = document.getElementById("roomUsersCount");
	var roomsList = document.getElementById("roomsList");
	var statusMessage = document.getElementById("statusMessage");

	// Join room button handler
	joinRoomBtn.addEventListener('click', function () {
		var roomName = roomNameInput.value.trim();
		if (roomName) {
			joinRoom(roomName);
		} else {
			alert('Please enter a room name');
		}
	});

	// Leave room button handler
	leaveRoomBtn.addEventListener('click', function () {
		leaveRoom();
	});

	// Allow pressing Enter to join room
	roomNameInput.addEventListener('keypress', function (e) {
		if (e.key === 'Enter') {
			joinRoomBtn.click();
		}
	});

	// Room event handlers from voip.js
	window.onRoomJoined = function (data) {
		currentRoom = data.room;
		currentRoomName.textContent = data.room;
		roomUsersCount.textContent = data.usersCount;
		currentRoomInfo.style.display = 'block';
		joinRoomBtn.style.display = 'none';
		leaveRoomBtn.style.display = 'inline-block';
		roomNameInput.disabled = true;
		statusMessage.textContent = '';
		console.log('Joined room:', data.room);
	};

	window.onRoomLeft = function () {
		currentRoom = null;
		currentRoomInfo.style.display = 'none';
		joinRoomBtn.style.display = 'inline-block';
		leaveRoomBtn.style.display = 'none';
		roomNameInput.disabled = false;
		statusMessage.textContent = '';
		console.log('Left room');
	};

	window.onUserJoined = function (data) {
		roomUsersCount.textContent = data.usersCount;
		console.log('User joined room:', data.userId);
	};

	window.onUserLeft = function (data) {
		roomUsersCount.textContent = data.usersCount;
		console.log('User left room:', data.userId);
	};

	window.onRoomsList = function (rooms) {
		if (Object.keys(rooms).length === 0) {
			roomsList.innerHTML = 'No active rooms';
		} else {
			var html = '<ul style="margin: 5px 0; padding-left: 20px;">';
			for (var roomName in rooms) {
				html += '<li><strong>' + roomName + '</strong> (' + rooms[roomName].users + ' users)</li>';
			}
			html += '</ul>';
			roomsList.innerHTML = html;
		}
	};

	var startBtn = document.getElementById("startBtn");
	var muteBtn = document.getElementById("muteBtn");
	var isMuted = false;

	startBtn.addEventListener('click', function () {
		if (!currentRoom) {
			statusMessage.textContent = '⚠️ Please join a room first!';
			return;
		}
		startBtn.style.display = 'none';
		muteBtn.style.display = 'inline-block';
		document.getElementById('audioLevelsPanel').style.display = 'block';
		startTalking();
	});

	// Mute/Unmute button handler
	muteBtn.addEventListener('click', function () {
		isMuted = !isMuted;
		toggleMute(isMuted);

		if (isMuted) {
			muteBtn.textContent = '🔊 Unmute';
			muteBtn.classList.add('muted');
			document.getElementById('micAudioLevel').classList.add('muted');
		} else {
			muteBtn.textContent = '🔇 Mute';
			muteBtn.classList.remove('muted');
			document.getElementById('micAudioLevel').classList.remove('muted');
		}
	});

	var micaudio = document.getElementById("micaudio");
	var micctx = micaudio.getContext("2d");
	micctx.fillStyle = "#FF0000";

	var incaudio = document.getElementById("incaudio");
	var incctx = incaudio.getContext("2d");
	incctx.fillStyle = "#FF0000";

	// Audio level meter elements
	var micAudioLevel = document.getElementById("micAudioLevel");
	var micLevelText = document.getElementById("micLevelText");
	var incAudioLevel = document.getElementById("incAudioLevel");
	var incLevelText = document.getElementById("incLevelText");

	// Calculate RMS (Root Mean Square) for audio level
	function calculateAudioLevel(audioData) {
		var sum = 0;
		for (var i = 0; i < audioData.length; i++) {
			sum += audioData[i] * audioData[i];
		}
		var rms = Math.sqrt(sum / audioData.length);
		// Convert to percentage (0-100), clamped
		var percentage = Math.min(100, Math.max(0, rms * 100));
		return percentage;
	}

	onMicRawAudio = function (audioData, soundcardSampleRate) { //Data right after mic input
		micctx.clearRect(0, 0, micaudio.width, micaudio.height);
		for (var i = 0; i < audioData.length; i++) {
			micctx.fillRect(i, audioData[i] * 100 + 100, 1, 1);
		}

		// Update microphone audio level meter
		var level = calculateAudioLevel(audioData);
		micAudioLevel.style.width = level + '%';
		micLevelText.textContent = Math.round(level) + '%';

		// Add active class if there's significant audio
		if (level > 5 && !isMuted) {
			micAudioLevel.classList.add('active');
		} else {
			micAudioLevel.classList.remove('active');
		}

		return audioData;
	}

	onUserDecompressedAudio = function (audioData, userId, sampleRate, bitRate) { //Called when user audiodata coming from the client
		incctx.clearRect(0, 0, incaudio.width, incaudio.height);
		for (var i = 0; i < audioData.length; i++) {
			incctx.fillRect(i, audioData[i] * 100 + 100, 1, 1);
		}

		// Update incoming audio level meter
		var level = calculateAudioLevel(audioData);
		incAudioLevel.style.width = level + '%';
		incLevelText.textContent = Math.round(level) + '%';

		// Add active class if there's significant audio
		if (level > 5) {
			incAudioLevel.classList.add('active');
		} else {
			incAudioLevel.classList.remove('active');
		}

		return audioData;
	}
});