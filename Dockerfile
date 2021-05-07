FROM node:lts-alpine
WORKDIR /usr/src/niles
COPY . .

# npm setup
RUN npm install --production
CMD [ "node", "index.js"]
