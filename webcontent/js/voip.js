var commonSampleRates = [8000,11025,12000,16000,22050,24000,32000,37800,44100,44056,47250,48000,50000,50400,88200,96000,176400,192000,2822400,5644800];
var commonBitRates = [8,16,32];
var mySampleRate = 8000;
var myBitRate = 8; //8,16,32
var myMinGain = 4/100;
var micEnabled = false;
function addEcodingInformation(data, samplingRate, bitRate){
	var buff = new ArrayBuffer(data.byteLength+2);
	var newView = new Uint8Array(buff);
	var oldView = new Uint8Array(data.buffer);
	var i=0;
	for(i = 0;i<oldView.length;i++){
	    newView[i] = oldView[i];
	}
	newView[i++] = commonSampleRates.indexOf(samplingRate);
	newView[i++] = bitRate;
	return newView;
}

function getEncodingInformation(bitdata) {
	var buff = new ArrayBuffer(bitdata.byteLength-2);
	var newView = new Uint8Array(buff);
	var oldView = new Uint8Array(bitdata);
	var i=0;
	for(i=0;i<newView.length;i++) {
		newView[i] = oldView[i];
	}
	var audioSamplingRate = oldView[i++];
	var audioBitRate = oldView[i++];
	return [newView.buffer, commonSampleRates[audioSamplingRate], audioBitRate];
}

function hasGetUserMedia() {
  return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

var downSampleWorker = new Worker('./js/voipWorker.js');
var upSampleWorker = new Worker('./js/voipWorker.js');
var steamBuffer = {}; //Buffers incomeing audio
var wsConnect = false; //is true if client is connected

var myWebSocket = new WebSocket("ws://127.0.0.1:9002");
myWebSocket.binaryType = "arraybuffer";

myWebSocket.onopen = function(evt) { 
	wsConnect = true;
	if(typeof(client) != "undefined") {
		wsSendStrings(["client", "nn", client["nn"]]);
		wsSendStrings(["client", "pp", client["pp"]]);
	}
}; 

myWebSocket.onclose = function(evt) { 
	wsConnect = false;
};

function wsSendStrings(msg) {
	if(wsConnect) {
		var sendSting = "";
		for(var i in msg) {
			if(sendSting!=="") {
				sendSting+="###";
			}
			sendSting +=msg[i];
		}
		if(sendSting !== "")
			console.log("send",sendSting);
			myWebSocket.send(sendSting);
	}
}

myWebSocket.onmessage = function(evt) {
	if(typeof(evt.data)==="object") {
		if(micEnabled) {
			var data = evt.data;//new Uint16Array(evt.data);
			upSampleWorker.postMessage({
				"inc" : true,
				"inDataArrayBuffer" : data,
				"outSampleRate" : sampleRate,
				"outChunkSize" : 2048
			});
		}
	} else { //its a string
		console.log("send",evt.data);
		var msgs = evt.data.split("###");
		if(msgs[0]==="chat") {
			writeToChat(msgs[1],msgs[2])
		} else if(msgs[0] === "clientlist") {
			var cliensObj = JSON.parse(msgs[1]);
			$("#clientList").empty();
			for(var i=0;i<cliensObj.length;i++) {
				$("#clientList").append('<li id="li_cl'+cliensObj[i]["clientId"]+'"><span id="sp_cl'+cliensObj[i]["clientId"]+'" class="label label-primary">'+cliensObj[i]["nn"]+'</span></li>');
			}
		}
	}
};


downSampleWorker.addEventListener('message', function(e) {
	if(wsConnect) {
		myWebSocket.send(e.data);
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
	var sampleRate = context.sampleRate;
	navigator.getUserMedia = ( navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);
	navigator.getUserMedia({audio: true}, function(stream){
		micEnabled = true;
		var gainSlider = $("#momentMaxGain");
		$(".onlyIfMicInputIsOn").show();
		$(".onlyIfMicInputIsOff").hide();
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

			if(settingsModalOpen) {
				var max = 0;
				for(var i=0;i<inData.length;i++) {
					if(max<inData[i])
						max = inData[i];
				}
				var g = Math.pow(max, 1/4)*100;
				if(g > 80)
					gainSlider.css("background", "#f44336");
				else
					gainSlider.css("background", "#009587");
				gainSlider.css("width", g+"%");
			}

			if(client.mic) {
				downSampleWorker.postMessage({
					"inc" : false,
					"inDataArrayBuffer" : inData,
					"inSampleRate" : sampleRate,
					"outSampleRate" : mySampleRate,
					"outBitRate" : myBitRate,
					"minGain" : myMinGain
				});
			}

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

