---
layout: default
title: Docker self-hosting
parent: Self-hosting
nav_order: 2
---

## Self-hosting on Docker
### Setup
1. Create your `./secrets.json` file as described in [selfhost setup](/self-hosting/selfhost#secrets.json)
2. Make sure you also have a google service account file.

## Running Niles on Docker

### docker-compose
1. Create a folder on your local machine for Niles
2. Copy your secrets and service account files to this folder as `secrets.json` and `niles-sa.json` respectively 
3. Start Niles with `docker-compose up -d`

### docker command line
Assuming you are running from a directory with both `secrets.json` and `niles-sa.json`

```sh
docker run -d \
  --name Niles \
  -v ./secrets.json:/usr/src/niles/config/secrets.json \ 
  -v ./niles-sa.json:/usr/src/niles/config/niles-sa.json \
  mchangrh/niles:latest
```

## System Requirements
Recommended OS for just running docker is [Alpine Linux](https://www.alpinelinux.org/) or [Flatcar Container Linux](https://www.flatcar-linux.org/)

One CPU core should be enough for bots serving under 10 Servers

Niles currently has [a memory leak](https://github.com/niles-bot/Niles/issues/78) so 300MB will let the bot run for about 1 month without crashing