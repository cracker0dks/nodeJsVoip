FROM node:boron

MAINTAINER rofl256

# Create app directory
RUN mkdir -p /opt/app
WORKDIR /opt/app

# Install app dependencies
COPY ./package.json /opt/app
RUN npm install

# Bundle app source
COPY . /opt/app

EXPOSE 80
EXPOSE 443

CMD [ "npm", "start" ]