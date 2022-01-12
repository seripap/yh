FROM node:14.18.3

RUN apt-get update
RUN apt-get install -y --no-install-recommends python vim curl ca-certificates build-essential iputils-ping

RUN npm install -g supervisor

WORKDIR /installation
COPY ./api/package.json .
RUN npm install
ENV NODE_PATH=/installation/node_modules

WORKDIR /api
COPY ./api .

CMD node worker.js
