FROM node:lts-alpine3.15
WORKDIR /usr/src/niles
COPY . .
RUN npm install --production
CMD [ "npm", "start"]