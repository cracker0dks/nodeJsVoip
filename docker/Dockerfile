FROM debian:8

MAINTAINER cracker0dks

WORKDIR /opt

RUN  apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y && apt-get install -y git curl && \
curl -sL https://deb.nodesource.com/setup_6.x | bash - && apt-get install -y nodejs
RUN git clone https://github.com/cracker0dks/nodeJsVoip && cd /opt/nodeJsVoip && npm install
CMD ["node /opt/nodeJsVoip/server.js"]