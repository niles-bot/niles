---
layout: default
title: Commands and Usage
last_modified_date: true
nav_order: 3
---

# Commands and Usage
{: .no_toc }

All commands must have valid prefix or mention Niles, i.e. `!command` or `@niles command`.

---

## Commands

| Command                             | Usage                                    | Description                                              |
|:------------------------------------|:-----------------------------------------|:---------------------------------------------------------|
| [display](#display)                 | `!display`                               | Display the calendar                                     |
| [update](#update)                   | `!update`                                | Update the calendar                                      |
| [create](#create)                   | `!create <event name at time on day>`    | Create new events                                        |
| [delete](#delete)                   | `!delete <event name>`                   | Delete existing events                                   |
| [clean](#clean)                     | `!clean `<number of messages to delete>` | Delete Discord messages in channel                       |
| [id](#id)                           | `!id <calendar_id>`                      | Set Google Calendar ID                                   |
| [tz](#tz)                           | `!tz <timezone>`                         | Set timezone                                             |
| [setup](#setup)                     | `!setup`                                 | Get setup instructions                                   |
| [invite](#invite)                   | `!invite`                                | Generate Niles bot invite link                           |
| [prefix](#prefix)                   | `!prefix <new_prefix>`                   | Change the Niles bot prefix                              |
| [displayoptions](#displayoptions)   | `!displayoptions <option> <setting>`     | Change the calendar display/formatting options           |
| [admin](#admin)                     | `!admin <restricted_admin_role>`         | Restrict the usage of Niles to a specific server role    |
| [help](#help)                       | `!help`                                  | Get this list of commands in Discord                     |
| [stats](#stats)                     | `!stats`                                 | Display Niles bot statistics                             |
| [ping](#ping)                       | `!ping`                                  | Pong                                                     |

---

### display

Use `!display` or `@niles display` to display your calendar. This commmand will only work after setup, i.e. after a valid calendar ID and timezone have been given.

You can only use `display` in _one_ channel in any one server.  Niles will attempt to continually update this _one_ calendar every 5 minutes.

---

### update

Use `!update` or `@niles update` to force update your calendar. This can force update after you have created new events, changed display options or other settings.
After using `update` Niles will continue to update this calendar every 5 minutes.

---

### create

Use `!create` or `@niles create` to add new events to your calendar. This command takes whatever input you give to it and uses the default Google Calendar interpreter.
The form of use is `!create <event for Google to parse>`.

A reliable way of using this is `!create <event name> on <event day> from <start time> to <end time>`, i.e. `create Among Us on Friday from 5pm to 11pm`

#### Formatting
* Numerical date formats supported:
  * MM DD YY
  * M D YY
  * YYYY MM DD
* Textual date formats are supported in English only e.g. `September 4 2020`
* Multi-day events can be created with keywords " - " or " to " etc...
e.g. `01/30/2020 - 05/30/2020`

There is no way to change it and no plans to add middleware to convert it (Natural Language Processing is out of the scope of Niles)

Niles will automatically update the calendar, delete the creation messages and confirmation messages.

**Important**: The 'native' Google parser will read the event times in the timezone that your Google Calendar is set to.  If you are having issues with incorrect times being registered with `create`, we recommend ensuring that your Google Calendar and Niles share the same timezone.

![create-event](../../assets/images/create-event.gif)
{: .text-center }

For complicated, recurring or multi-day events, these *can* be created using this parser, but we recommend just creating the events in the Google Calendar Web UI, where possible.

---

### delete

Use `!delete <event_name>` or `@niles delete <event name>` to delete an event from your Calendar.  The `<event_name>` should be exactly what it is named in your calendar.
Note that when deleting events using this method, Niles does not currently handle events with the same name, and will delete the *latest* event.

We recommend deleting events in the Google Calendar Web UI, where possible.

---

### next

Use `!delete` or `@niles next` to display the next upcoming event within the set days to display.

---

### clean

Use `!clean <number of messages to clean>` or `@niles clean <number of messages to clean>` to tidy up your calendar channel etc. prior to or after posting your calendar.

Due to Discord limitations, Niles cannot clean messages older than 14 days.

![clean](../../assets/images/clean.gif)
{: .text-center }
---

### id

Use `!id <google_calendar_id>` or `@niles id <google_calendar_id>` to add or change the Google Calendar associated with your Discord Server.  This must be a valid calendar ID, from the 'Settings and Sharing'>'Integrate' section of the Calendar you want to use.

Niles must have access to your calendar.  You can only use *one* Google Calendar per server.

---

### tz

Use `!tz <timezone>` or `@niles tz <timezone>` to add or change the timezone associated with your Discord Server.

This can be done using `!tz` i.e.

`!tz America/New_York`
`!tz UTC+5`
`!tz EST`

[Full list of TZ database names on Wikipedia](https://cutt.ly/tz)

---

### validate

Use `!validate` or `@niles validate` to check for any errors with the timezone, calendar ID, calendar fetching or permissions.

---

### calname

Use `!calname` or `@niles calname` to rename the CALENDAR link name to something else

---

### auth

Use `!auth` or `@niles auth` to set up authorization with OAuth2 or to switch back to service account

---

### channel

Use `!channel` or `@niles channel` to set a channel to be the default channel for all calendar updates and postings with subcommands `set` and `delete`

---

### setup

Use `!setup` or `@niles setup` to display a summary of the setup steps for getting started with Niles.

---

### locale
Use `!locale` or `@niles locale` to set up your locale for date/ time and text.

**Text Translation**

You can see the supported languages and translation progress on [Crowdin](https://crowdin.com/project/niles)

If a language's text is not fully supported, it will fall back to English, but the date formatting will be preserved. 

Only ISO 3166-1 Alpha-2 Codes are supported. You can see a list [here](https://en.wikipedia.org/wiki/ISO_3166-1#Current_codes)

If you would like to contribute to the text translations, please let `blabdude#9793` know so they can add you to the translator channel on Discord. If you do not wish to be added, you can join the [Crowdin project](https://crwd.in/niles)

If you would like to request a language to be translated, please fill out this [Google Form](https://forms.gle/F7Agu3irz99F7Pff9)

---

### invite

Use `!invite` or `@niles display` to generate an invite link to add Niles to a server.

---

### prefix

Use `!prefix <new_prefix>` or `@niles prefix <new_prefix>` to change the prefix for the server. i.e.
`@niles prefix ?!`. Niles would then respond to `?!help` etc.

You can also use `@niles prefix` to find out what the prefix has been changed to if you forget.

---

### displayoptions

For details on display options, refer to Configuration/Display Options.

---

### admin

Use `!admin <role>` or `@niles admin <role>` to restrict the usage of Niles to people with the role.
i.e. `!admin scheduler` or `!admin captain`. The `<role>` *is* case sensitive.

**Important**: Make sure *you* have the role that you are about to restrict the usage of Niles to. You can only restrict the usage to *one* role.
---

### help

Use `!help` or `@niles help` to get a list of the available commands and a summary of what they do.

---

### stats

`!stats` or `@niles stats` display a list of usage statistics about the Niles bot.

---

### ping

`!ping` or `@niles ping` - pong!
