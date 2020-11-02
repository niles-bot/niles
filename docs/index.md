---
layout: default
---

[Niles](https://niles.seanecoffey.com/) is a Discord bot for displaying a simple calendar that interfaces with Google Calendar.

![example](https://i.imgur.com/3yYK4QB.png)

## Niles can help you if...

* You want to create a single channel to manage events in your Discord server.
* You want to sync events from ([Google Calendar](https://calendar.google.com)).

## Setup

1. First [invite Niles](https://discord.com/oauth2/authorize?client_id=320434122344366082&scope=bot&permissions=523344) to your Discord server.

2. Now, either create a new Google calendar or use an existing one, and under **Settings > Calendars > 'Calendar Name'**, select 'Share This Calendar'. Under 'Share with a specific person' add `niles-291@niles-169605.iam.gserviceaccount.com` and make sure you give permission **Make changes to events**.

3. Next scroll down to 'Integrate calendar' and copy the **Calendar ID** - You'll need this to setup Niles in your Discord Server.

4. Run `!setup` in your `#general` to get started.

Visit the [setup page](https://niles.seanecoffey.com/setup) for more detailed setup information.

## Usage

### Commands

* `!help`     - Get a DM of the list of commands and usage.
* `!setup`    - Get instructions for setting Niles up for use in your Discord.
* `!id`       - Set the Google Calendar ID for the calendar you want Niles to sync to.
* `!tz`       - Set the preferred timezone of your Discord server, use either `!tz America/New_York` or `!tz UTC+4` or `!tz EST`
* `!display`  - Prints a message with the calendar.
* `!update`   - Checks for any new events and updates the last printed calendar, also works as `!sync`.
* `!prefix`   - Change the prefix that Niles uses in the server.
* `!admin `   - Restrict usage to a specific role, i.e. "Scheduler" or "Captain".
* `!create`   - Create a new event: `!create 4legs friday 8pm-10pm`, also works with `!scrim`.
* `!delete`   - Delete an event: `!delete <event_name>`, i.e. `!delete 4legs`.
* `!clean`    - Deletes a certain number of messages: `!clean 5` (deletes previous 5 messages), also works with `!purge`
* `!invite`   - Get the invite link for the Niles.
* `!stats`    - Display the stats for the bot.
* `!ping`     - Pong!
* `!count`    - Check if a calendar updater thread is running in your server.

### Display Options

* `!displayoptions help`      - Turn off the help text under the calendar, takes 1 or 0 as input (on or off) i.e. `!displayoptions help 0` to turn off help text.
* `!displayoptions pin`       - Turn off pinning of the calendar, takes 1 or 0 as input (on or off) i.e. `!displayoptions pin 0` to turn off pinning.
* `!displayoptions format`    - Change clock format between 12 and 24-hour clock format, takes 12 or 24 as input i.e. `displayoptions format 24` to disply events in 24-hour clock format.
* `!displayoptions tzdisplay` - Turn off timezone display, take 1 or 0 as input (on or off) i.e. `!displayoptions tzdisplay 0` to turn off timezone display.
* `!displayoptions emptydays` - Hide or show empty days, takes 1 or 0 as input (show or hide) i.e. `!displayoptions emptydays 0` to hide empty days
* `!displayoptions showpast`  - Hide or show past events of today, takes 1 or 0 as input (show or hide) i.e. `!displayoptions showpast 1` to show past events
* `!displayoptions trim`      - Trim event names to n characters, with 0 being off. i.e. `!displayoptions trim 15` will limit event names to 5 characters and the rest being `...`
* `!displayoptions days`      - Set the number of days to display i.e. `!displayoptions days 14` will try to show 2 weeks of events (discord limits may hit! use `!displayoptions emptydays 0`)
* `!displayoptions style`     - use old or new event display style i.e. `!displayoptions style code` will use the old code format, `displayoptions style embed` will use the new embed format
* `!displayoptions inline`    - show event days inline (see below for examples), takes 0 or 1 as input (on or off) i.e. `!displayoptions inline 1` will make days appear inline.
* `!displayoptions description` - hide/show event description (only compatible with embed style )


### !create formatting
`!create` is entirely handled by Google Calendar.
Numerical date formats supported:
* MM DD YY
* M D YY
* YYYY MM DD

Textual date formats are supported in English only e.g. `September 4 2020`

Multi-day events can be created with keywords " - " or " to " etc...
e.g. `01/30/2020 - 05/30/2020`

There is no way to change it and no plans to add middleware to convert it (Natural Language Processing is out of the scope of Niles)

### Style
#### Code vs Embed
- Code supports up to 2048 characters, embed supports 6000 characters
- Descriptions can only be shown with embed

<details>
<summary>Code and Embed examples</summary>
<br>

Code

![image1](https://user-images.githubusercontent.com/15132783/97769587-84649180-1b02-11eb-8ac2-cbcb2550ac32.png)

Embed (Yes Inline)

![image2](https://user-images.githubusercontent.com/15132783/88202500-f6316300-cc16-11ea-9959-8b504efd8f68.png)

Embed (Not Inline)

![image3](https://user-images.githubusercontent.com/15132783/88202551-0ba68d00-cc17-11ea-9a6c-cb6a44db93c7.png)

</details>

## Support

Join the [Niles Discord server](https://discord.gg/jNyntBn) if you have issues or suggestions.

## Self-hosting

Visit the [self-host page](https://niles.seanecoffey.com/selfhost) for more detailed setup information.

## Author

Sean Coffey ([GitHub](https://github.com/seanecoffey)).

![Sean Coffey](https://puu.sh/wcgvn/5dd67ad9c9.png)

### License

[MIT License](https://seanecoffey.mit-license.org/)

Last update: 15 Oct 2020
