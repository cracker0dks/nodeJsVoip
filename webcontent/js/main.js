var socket = io();

var soundcardSampleRate = null; //Sample rate from the soundcard (is set at mic access)
var mySampleRate = 8000; //Samplerate outgoing audio
var myBitRate = 8; //8,16,32 - outgoing bitrate
var myMinGain = 4/100; //min Audiolvl
var micEnabled = false;

var downSampleWorker = new Worker('./js/voipWorker.js');
var upSampleWorker = new Worker('./js/voipWorker.js');

var socketConnected = false; //is true if client is connected
var steamBuffer = {}; //Buffers incomeing audio

function hasGetUserMedia() {
  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

io.on('connection', function(socket){
	console.log('socket connected!');
	socketConnected = true;
	socket.on('disconnect', function(){
		console.log('socket disconnected!');
		socketConnected = false;
	});

	socket.on('d', function(data){ 
		if(micEnabled) {
			upSampleWorker.postMessage({
				"inc" : true,
				"inDataArrayBuffer" : data["a"], //Audio data
				"outSampleRate" : soundcardSampleRate,
				"outChunkSize" : 2048,
				"socketId" : data["sid"];
			});
		}
	});
});

downSampleWorker.addEventListener('message', function(e) {
	if(socketConnected) {
		socket.emit("d", e.data);
	}
}, false);

upSampleWorker.addEventListener('message', function(e) {
	var data = e.data;
	var clientId = data[0];
	var voiceData = data[1];
	clientMsgsForTimeout[clientId] = +new Date();
	$("#sp_cl"+clientId).removeClass("label-primary");
	$("#sp_cl"+clientId).addClass("label-info");
	if(typeof(steamBuffer[clientId])==="undefined"){
		steamBuffer[clientId] = [];
	}
	if(steamBuffer[clientId].length>5)
		steamBuffer[clientId].splice(0,1);
	steamBuffer[clientId].push(voiceData);
	//console.log(steamBuffer);
}, false);


if (hasGetUserMedia()) {
	var context = new window.AudioContext || new window.webkitAudioContext;
	soundcardSampleRate = context.sampleRate;
	navigator.getUserMedia = ( navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);
	navigator.getUserMedia({audio: true}, function(stream){
		var liveSource = context.createMediaStreamSource(stream);
		// create a ScriptProcessorNode
		if(!context.createScriptProcessor){
			node = context.createJavaScriptNode(2048, 1, 1);
		} else {
			node = context.createScriptProcessor(2048, 1, 1);
		}

		node.onaudioprocess = function(e){
			var inData = e.inputBuffer.getChannelData(0);
			var outData = e.outputBuffer.getChannelData(0);

			downSampleWorker.postMessage({
				"inc" : false, //its audio from the client so false
				"inDataArrayBuffer" : inData,
				"inSampleRate" : soundcardSampleRate,
				"outSampleRate" : mySampleRate,
				"outBitRate" : myBitRate,
				"minGain" : myMinGain
			});

			var allSilence = true;
			for(var c in steamBuffer) {
				if(steamBuffer[c].length!==0) {
					allSilence = false;
				}
			}
			if(allSilence) {
				for(var i in inData) {
					outData[i] = 0;
				}
			} else {
				var div = false;
				for(var c in steamBuffer) {
					if(steamBuffer[c].length != 0) {
						if(client.sound) {
							for(var i in steamBuffer[c][0]) {
								if(div)
									outData[i] = (outData[i]+steamBuffer[c][0][i])/2;
								else
									outData[i] = steamBuffer[c][0][i];
							}
						}
						steamBuffer[c].splice(0,1);
						div = true;
					}
				}
			}
		}

		//Lowpass
  		biquadFilter = context.createBiquadFilter();
  		biquadFilter.type = 0;
  		biquadFilter.frequency.value = 3000;

  		liveSource.connect(biquadFilter);

  		//Dynamic Compression
		dynCompressor = context.createDynamicsCompressor();
		dynCompressor.threshold.value = -25;
		dynCompressor.knee.value = 9;
		dynCompressor.ratio.value = 8;
		dynCompressor.reduction.value = -20;
		dynCompressor.attack.value = 0.0;
		dynCompressor.release.value = 0.25;

		biquadFilter.connect(dynCompressor);
		dynCompressor.connect(node);

		node.connect(context.destination);
	}, function(err) {
		console.log(err);
	});
} else {
	alert('getUserMedia() is not supported in your browser');
}
