FROM node:lts-alpine3.12
LABEL maintainer="michael@mchang.name"
WORKDIR /usr/src/niles
COPY . .

# npm setup
RUN npm install
CMD [ "node", "index.js"]
