---
layout: default
---

[Niles](http://seanecoffey.github.io/Niles) is a Discord bot for displaying a simple calendar that interfaces with Google Calendar.

![example](https://puu.sh/wcgpt/e209eef3ba.png)

## Niles can help you if...

* You want to create a single channel to manage events in your Discord server.
* You want to sync events from ([Google Calendar](https://calendar.google.com)).

## Setup

1. First [invite Niles](https://discordapp.com/oauth2/authorize?client_id=320434122344366082&scope=bot&permissions=523344) to your Discord server.

2. Now, either create a new Google calendar or use an existing one, and under **Settings > Calendars > 'Calendar Name'**, select 'Share This Calendar'. Under 'Share with a specific person' add `niles-291@niles-169605.iam.gserviceaccount.com` and make sure you give permission **Make changes to events**.

3. Next scroll down to 'Integrate calendar' and copy the **Calendar ID** - You'll need this to setup Niles in your Discord Server.

4. Run `!setup` in your `#general` to get started.

Visit the [setup page](http://niles.seanecoffey.com/setup) for more detailed setup information.

## Usage

### Commands

* `!help`     - Get a DM of the list of commands and usage.
* `!setup`    - Get instructions for setting Niles up for use in your Discord.
* `!id`       - Set the Google Calendar ID for the calendar you want Niles to sync to.
* `!tz`       - Set the preferred timezone of your Discord server, use format relative to GMT:`!tz GMT+10:00`
* `!init`     - Cleans messages from the current channel (all) and displays a calendar message.
* `!display`  - Prints a message with the calendar.
* `!update`   - Checks for any new events and updates the last printed calendar, also works as `!sync`.
* `!prefix`   - Change the prefix that Niles uses in the server.
* `!admin `   - Restrict usage to a specific role, i.e. "Scheduler" or "Captain".
* `!create`   - Create a new event: `!create 4legs friday 8pm-10pm`, also works with `!scrim`.
* `!delete`   - Delete an event: `!delete <day> <start time>`, i.e. `!delete friday 8pm`.
* `!clean`    - Deletes all messages in the current channel, also works as `!purge`.
* `!invite`   - Get the invite link for the Niles.
* `!stats`    - Display the stats for the bot.
* `!ping`     - Pong!

## Support

Join the [Niles Discord server](https://discord.gg/jNyntBn) if you have issues or suggestions.

## Author

Sean Coffey ([GitHub](http://github.com/seanecoffey)).

![Sean Coffey](https://puu.sh/wcgvn/5dd67ad9c9.png)

### License

[MIT License](http://seanecoffey.mit-license.org/)
