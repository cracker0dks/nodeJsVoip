var client = { //is observerd
	"pp" : null, //Profil Pic
	"nn" : "userXY", //Nickname
	"mg" : 4/100, // minGain
	"mic" : true,
	"sound" : true
}
var settingsModalOpen = false;
var clientMsgsForTimeout = [];

if(typeof(localStorage) !== "undefined") {
	var clientString = localStorage.getItem("client");
	if(typeof(clientString)==="string") {
		var newClientObject = JSON.parse(clientString);
		for(var i in newClientObject) {
			client[i] = newClientObject[i];
		}
	}
}

if(typeof(Object.observe)!=="undefined") {
	Object.observe(client, function(changes) {
		wsSendStrings(["client", changes[0].name, client[changes[0].name]]);
		localStorage.setItem("client",JSON.stringify(client));
		console.log(changes);
	});
} else if(typeof(client.watch)!=="undefined") { //Firefox (NO Observe)
	client.watch("pp", function(id, oldval, newval) {
		observeInfo(id, newval);
	});

	client.watch("nn", function(id, oldval, newval) {
		observeInfo(id, newval);
	});

	client.watch("mg", function(id, oldval, newval) {
		observeInfo(id, newval);
	});

	function observeInfo(name, newValue) {
		wsSendStrings(["client", name, newValue]);
		localStorage.setItem("client",JSON.stringify(client));
		console.log(name,newValue);
	}
}

function writeToChat(clientName,text) {
	clientName = clientName.replace(/<\/?[^>]+(>|$)/g, "");
	text = text.replace(/<\/?[^>]+(>|$)/g, "");
	text = text.linkify();
	$("#chatContent").append('<div><b>'+clientName+': </b>'+text+'</div>');
	var objDiv = document.getElementById("chatContent");
	objDiv.scrollTop = objDiv.scrollHeight;
}

$(document).ready(function() {
	$.material.init();

	
	/*---------------------------------------------------
		--- Settings UI Functions ---
	---------------------------------------------------*/
	window.setInterval(function() {
		for(var i in clientMsgsForTimeout) {
			if((+new Date()-clientMsgsForTimeout[i])>50) {
				$("#sp_cl"+i).addClass("label-primary");
				$("#sp_cl"+i).removeClass("label-info");
			}
		}
	},500);

	$(".onlyIfMicInputIsOn").hide();

	$("#toggleSound").click(function() {
		client.sound = !client.sound;
		checkMicAndSound();
	});

	$("#toggleMic").click(function() {
		client.mic = !client.mic;
		checkMicAndSound();
	});

	function checkMicAndSound() {
		if(!client.sound){
			$("#toggleSound").find("i").removeClass("mdi-av-volume-up");
			$("#toggleSound").find("i").addClass("mdi-av-volume-off");
		} else {
			$("#toggleSound").find("i").addClass("mdi-av-volume-up");
			$("#toggleSound").find("i").removeClass("mdi-av-volume-off");
		}

		if(!client.mic){
			$("#toggleMic").find("i").removeClass("mdi-av-mic");
			$("#toggleMic").find("i").addClass("mdi-av-mic-off");
		} else {
			$("#toggleMic").find("i").addClass("mdi-av-mic");
			$("#toggleMic").find("i").removeClass("mdi-av-mic-off");
		}
	}
	checkMicAndSound();
	

	function chatSend(text) {
		text = $.trim(text);
		if(text!=="") {
			wsSendStrings(["chat",text]);
			writeToChat(client.nn,text);
			$("#chatInput").val("");
		}
	}

	$("#chatSend").click(function() {
		chatSend($("#chatInput").val());
	});
	$( "#chatInput" ).keyup(function( event ) {
		if ( event.which == 13 ) {
		    event.preventDefault();
		    chatSend($("#chatInput").val());
		}
	});

	$("#nickname").val(client.nn);
	if(client.pp != null)
		$('#sProfilePic').attr( "src", client.pp );

	$("#inputProfilePic").change(function(){
	    readImage( this );
	});

	function readImage(input) {
	    if ( input.files && input.files[0] ) {
	    	if(input.files[0].type.indexOf("image")===-1) {
	    		alert("Bitte ein Bild wählen!");
	    	} else if(input.files[0].size>500000) {
	    		alert("Bitte ein Bild kleiner 0.5MB wählen!");
	    	} else {
	    		var FR= new FileReader();
		        FR.onload = function(e) {
		        	client.pp = e.target.result;
		             $('#sProfilePic').attr( "src", e.target.result );
		        };       
		        FR.readAsDataURL(input.files[0] );
	    	}
	    }
	}

	$("#nickname").focusout(function() {
		var nick = $.trim($("#nickname").val());
		if(nick !== "")
			client.nn = nick;
	});

	$('.slider').noUiSlider({
		start: [4],
		range: {
			'min': 0,
			'max': 100
		}
	});

	$(".slider").on({
		set: function(){
			myMinGain = Math.pow($(this).val()/100, 4);
			client.mg = myMinGain;
		}
	});
	

	for(var i=0;i<commonBitRates.length;i++) {
		if(commonBitRates[i] <= 16) {
			var s = "";
			if(commonBitRates[i] == myBitRate)
				s='selected="selected"';
			$("#bitrateSelect").append('<option '+s+' value="'+commonBitRates[i]+'">'+commonBitRates[i]+'</option>');
		}
	}
	$("#bitrateSelect").change(function() {
		myBitRate = parseInt($( "#bitrateSelect option:selected" ).val());
	});

	for(var i=0;i<commonSampleRates.length;i++) {
		if(commonSampleRates[i] < 20000) {
			var s = "";
			if(commonSampleRates[i] == mySampleRate)
				s='selected="selected"';
			$("#sampleRateSelect").append('<option '+s+' value="'+commonSampleRates[i]+'">'+commonSampleRates[i]+'kHz</option>');
		}
	}
	$("#sampleRateSelect").change(function() {
		mySampleRate = parseInt($( "#sampleRateSelect option:selected" ).val());
	});

	$('#settingsModal').on('hidden.bs.modal', function (e) {
	  	settingsModalOpen = false;
	})

	$('#settingsModal').on('shown.bs.modal', function (e) {
	  	settingsModalOpen = true;
	  	$("#minGainSlider").val(  Math.pow(client.mg, 1/4)*100 );
	})

});

if(!String.linkify) {
    String.prototype.linkify = function() {

        // http://, https://, ftp://
        var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;

        // www. sans http:// or https://
        var pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

        // Email addresses
        var emailAddressPattern = /[\w.]+@[a-zA-Z_-]+?(?:\.[a-zA-Z]{2,6})+/gim;

        return this
            .replace(urlPattern, '<a target="#" href="$&">$&</a>')
            .replace(pseudoUrlPattern, '$1<a target="#" href="http://$2">$2</a>')
            .replace(emailAddressPattern, '<a target="#" href="mailto:$&">$&</a>');
    };
}
