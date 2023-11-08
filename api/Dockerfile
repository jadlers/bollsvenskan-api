FROM node:18-alpine

# Make it possible to set timezone with env var TZ
RUN apk add --no-cache tzdata

WORKDIR /usr/src/api

COPY package.json ./
COPY yarn.lock ./

RUN yarn --production

COPY . .
RUN yarn build

EXPOSE ${API_SERVER_PORT}
CMD [ "yarn", "start" ]
