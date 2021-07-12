FROM node:lts-alpine3.14
WORKDIR /usr/src/niles
COPY . .
RUN npm install --production
CMD [ "npm", "start"]