FROM node:lts-alpine
WORKDIR /usr/src/niles
COPY . .
RUN npm install --production
CMD [ "npm", "start"]