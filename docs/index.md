---
layout: default
---

[Niles](http://seanecoffey.github.io/Niles) is a Discord bot for creating in-channel schedule calendars and interfacing with Google Calendar.

![example](https://puu.sh/wcgpt/e209eef3ba.png)

## Niles can help you if...

* You want to create a single channel to manage events in your Discord server.
* You want to sync events from ([Google Calendar](https://calendar.google.com)).

## Setup

First [invite Niles](https://discordapp.com/oauth2/authorize?permissions=97344&scope=bot&client_id=320434122344366082) to your Discord server.
Next either create a new Google calendar or use an existing one, and under **Settings > Calendars > 'Calendar Name'**, select 'Share This Calendar' and under 'Share with a specific person' add `niles-291@niles-169605.iam.gserviceaccount.com` and make sure you give permission **Make changes to events**.

Next head to 'Calendar details' and copy the **Calendar ID** - We'll use this when we setup Niles in your Discord Server.
Run `!setup` in your `#general` to get started.

Visit the [setup page](http://niles.seanecoffey.com/setup) for more detailed setup information.

## Usage

### Commands

* `!display`           - Displays your calendar.

* `!displayoptions`    - Using `!displayoptions help 0/1` will hide or show the additional help instructions under your calendar.

* `!update / !sync`    - Forces the calendar to check Google calendar for updates.

* `!create / !scrim`   - Create events using GCal's quick add interpretation. Works best with something like `!scrim xeno on jun 23 8pm-9pm`.

* `!clean / !purge`    - Deletes messages in channel, you can specify number like `!clean 4`. This cannot delete messages that are older than 14 days.

* `!stats / !info`     - Displays Niles info, i.e. no. of servers, RAM usage.

* `!invite`            - Get the invite link for Niles to join a server!

* `!setup`             - Get details on how to setup Niles

* `!id`                - Set the Google calendar ID for the guild

* `!tz`                - Set the timezone for your calendar, must be in the form of `GMT-00:00`, i.e. `!tz gmt+04:30`.

* `!prefix`            - View or change the prefix for Niles in your server.

* `!help`              - Display usage options for Niles.

* `!init`              - *WARNING* deletes all your settings and re-initialises Niles in your server, you will need to run `!setup` again.

* `!ping`              - Pong!

## Support

Join the [Niles Discord server](https://discord.gg/jNyntBn) if you have issues or suggestions.

## Author

Sean Coffey ([GitHub](http://github.com/seanecoffey)).

![Sean Coffey](https://puu.sh/wcgvn/5dd67ad9c9.png)

### License

[MIT License](http://seanecoffey.mit-license.org/)
