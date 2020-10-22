FROM node:12-alpine3.12
LABEL maintainer="michael@mchang.name"
WORKDIR /usr/src/niles
COPY . .

# set up stores
RUN cp stores/store.json.example stores/guilddatabase.json && \
    cp stores/store.json.example stores/users.json && \
    rm stores/store.json.example

# npm setup
RUN npm install
CMD [ "node", "index.js"]
