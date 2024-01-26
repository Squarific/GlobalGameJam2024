# Base image
FROM node:current AS build


WORKDIR /usr/src/app
# Copy all files
COPY ./src/server/simpleBroadcast/libraries/simpleRealtimeBroadcast .

RUN npm install

# Start server
CMD node main.js
EXPOSE 8080