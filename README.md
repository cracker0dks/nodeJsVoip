# nodeJsVoip
An simple nodeJs Websocket VOIP application without the use of WebRTC and extra Servers like TURN or STUN. No client proxy!

#How to install the Server
1. install node
2. install ws module: npm install ws
3. start the Server run: node server.js

#How to setup the client
1. change the ip in ./webcontent/js/voip.js to your server ip
2. Host the Webcontent on a webserver

Now you can visit the index.html on your webserver!

NOTE: Chrome only allow getUserMedia on SSL servers from now on. So be sure to use HTTPS.

TODO: improve sound quallity
