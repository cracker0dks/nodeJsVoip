# nodeJsVoip
An simple nodeJs Websocket VOIP application without the use of WebRTC and extra Servers like TURN or STUN. No client proxy!

> Note: this is just an experiment. Pls use WebRTC if you want to create a professional VOIP application!

# How to install the Server (manually)
1. Install npm and node
2. Clone or download this repo and go to the "nodeJsVoip" folder
3. install node deps -> run: `npm install`
4. start the Server -> run: `node server.js`
5. connect to https://myserverip (with 2 tabs or browsers to hear yourself)

## Supported (tested) browsers
* Chrome
* Firefox
* Edge

# How to install the Server with docker
You have 2 options for using this app with docker
## Use the container from Dockerhub
`docker run -d --name=nodejsvoip -p 80:80 -p 443:443 rofl256/nodejsvoip`

Now connect to https://myserverip

## Build your own image
`sudo docker build -t nodejsvoip .`
now run the container from the image you have just created. (use the command from above and change the image name)

# Roadmap
* improve sound quallity by implementing opus

# Audiopipeline Details

![alt tag](https://raw.githubusercontent.com/cracker0dks/nodeJsVoip/master/doc/audioPipeline.png)
