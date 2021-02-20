# Niles Discord Bot
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/389e3ab3b7e54bd080c7db118bc87a0f)](https://app.codacy.com/gh/niles-bot/niles?utm_source=github.com&utm_medium=referral&utm_content=niles-bot/niles&utm_campaign=Badge_Grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/42ad70ef7e0842da99a2176d5684e0a3)](https://www.codacy.com/gh/niles-bot/niles/dashboard)
[![codebeat Badge](https://codebeat.co/badges/dc7cdd12-2d64-48b4-95c7-7fe3f5cf81a4)](https://codebeat.co/projects/github-com-niles-bot-niles-master)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/niles-bot/niles/docker-ci)](https://hub.docker.com/r/nilesbot/niles)
[![Uptime Robot ratio (30 days)](https://img.shields.io/uptimerobot/ratio/m786400338-c0cc4ceea17d04b822cc83d9)](https://status.mchang.icu/786400338)
![node-current](https://img.shields.io/node/v/discord.js)

A [Discord](https://discord.com/) bot for using [Google Calendar](https://calendar.google.com) to manage events.
Targeted towards eSports event scheduling (scrims, PCWs).

![example](https://i.imgur.com/3yYK4QB.png)

## Getting Started

[Invite the hosted bot to your Discord here](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=320434122344366082).

Join the [Niles Discord server](https://discord.gg/jNyntBn) for support, bug reporting and feature requests.

Visit the Niles [website](https://nilesbot.com/) or [setup guide](https://nilesbot.com/start) for more detailed use and setup descriptions.

If you wanted to host your own version or similar, these instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

* [Node.js](https://nodejs.org/) - v12 or higher

### Installing

Setup your Discord app on the [Discord developers website](https://discord.com/developers/applications/me).

Note: To add a development bot to your Discord server, visit https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot&permissions=97344 replacing your app id in the URL.

Set up a [Google Service Account](https://developers.google.com/identity/protocols/OAuth2ServiceAccount).
For more information on setting up a Google Service Account, [see here](https://github.com/yuhong90/node-google-calendar/wiki#setup-service-accounts).

Alternative, set up [OAuth2 Credentials](https://support.google.com/cloud/answer/6158849).

Create your own `secrets.json` file in `/config`, using the appropriate values, making sure you also place a copy of your Google Service Account JSON security file somewhere and referencing in `secrets`.

To run and connect your bot

```
npm install
```

```
node index.js
```

## Built With

* [Discord.js](https://github.com/discordjs/discord.js) - NodeJS library for interfacing with the Discord API
* [googleapis](https://www.npmjs.com/package/googleapis) - Google APIs Node.js Client

## License

This project is licensed under the MIT License
