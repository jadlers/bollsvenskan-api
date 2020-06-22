FROM node:lts-alpine

WORKDIR /usr/src/api

COPY package.json ./
COPY yarn.lock ./

RUN yarn

COPY . .
RUN yarn build

EXPOSE ${API_SERVER_PORT}
CMD [ "yarn", "start" ]
