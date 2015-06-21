
function downSample(fromSampleRate, toSampleRate, buffer) {
	var outLength = buffer.length/(fromSampleRate / toSampleRate);
	var outBuffer = [];
	var s = Smooth(buffer,{scaleTo:outLength, method: 'cubic'});
	for(var i=0;i<outLength;i++) {
		outBuffer.push(s(i));
	}
	return outBuffer;
}

var sampleBuffer = [];
function upSample(fromSampleRate, toSampleRate, chunkSize, buffer, callBack) {
	var outLength = buffer.length/(fromSampleRate / toSampleRate);
	var outBuffer = [];
	var s = Smooth(buffer,{scaleTo:outLength, method: 'cubic'});

	for(var i=0;i<outLength;i++) {
		sampleBuffer.push(s(i));
		if(sampleBuffer.length>=chunkSize) {
			callBack(sampleBuffer);
			sampleBuffer = [];
		}
	}
	console.log(sampleBuffer);
}
