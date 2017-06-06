# Niles Discord Bot

** In Development **

NodeJS bot for interfacing with Google Calendars for eSports scheduling

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

* [Node.js](https://nodejs.org/en/) - v8 or higher

### Installing

Setup your Discord app on the [Discord developers website](https://discordapp.com/developers/applications/me).

Note: To add a development bot to your Discord server, visit https://discordapp.com/api/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot&permissions=0 replacing your app id in the URL.

Set up your [Google Service Account](https://developers.google.com/identity/protocols/OAuth2ServiceAccount).
For more information on setting up a Google Service Account, [see here](https://github.com/yuhong90/node-google-calendar/wiki#setup-service-accounts).

Rename the `PUBLIC.ENV` file to `.ENV` and add the relevant variables.

To run and connect your bot

```
npm install
```

```
node bot.js
```

## Testing

Absolutely nothing

## Deployment

Might eventually host this whom knows

## Built With

* [Discord.js](https://github.com/hydrabolt/discord.js/) - NodeJS library for interfacing with the Discord API
* [node-google-calendar](https://github.com/yuhong90/node-google-calendar) - Simple Node module that supports Google Calendar API

## License

This project is licensed under the MIT License
