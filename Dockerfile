FROM node:lts-alpine
LABEL maintainer="michael@mchang.name"
WORKDIR /usr/src/niles
COPY . .

# set up stores
RUN cp stores/store.json.example stores/guilddatabase.json && \
    rm stores/store.json.example

# npm setup
RUN npm install
CMD [ "node", "index.js"]
