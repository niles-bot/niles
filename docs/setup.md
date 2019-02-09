---
layout: default
---

## Setup Guide

First [invite Niles](https://discordapp.com/oauth2/authorize?client_id=320434122344366082&scope=bot&permissions=523344) to your Discord server.


### 1. Configure Google Calendar

Create or select a Google calendar, and then head to **Settings > Calendars > 'The calendar you want to use in Discord'**

Now,  select 'Share This Calendar' and under 'Share with a specific person' add


`niles-291@niles-169605.iam.gserviceaccount.com`


and make sure you give permission **Make changes to events**.

![gcalexample](https://puu.sh/wlkTD/ca35e632f4.png)

Next head to 'Calendar details' and copy the **Calendar ID** - We'll use this when we setup Niles in your Discord Server.


![gcalidexample](https://puu.sh/wlkVW/2bac1bfc70.png)


### 2. Add your Google Calendar ID

Now, in a channel where Niles has permissions (i.e. #general or another channel you have setup) we can use `!id`.

`!id calendarID` i.e.

`!id qb9t3fb6mn9p52a4re0hc067d8@group.calendar.google.com`


### 3. Add your timezone

We could pull this from your Google calendar or Discord server, but since your members might be in different timezones, you must add your own.

This can be done using `!tz` i.e.

`!tz GMT+10:00`
`!tz GMT-03:00`
`!tz GMT+00:00`

and must be formatted like this with all 4 digits, +/- GMT time, including `:00`. UTC is the same as GMT.


### 4. Run your calendar for the first time!

Great now we can tell Niles to pull events from our GCal, setting up the database and display our calendar.

`!display` - Displays the calendar WITHOUT deleting any messages.

Both methods pin the current calendar to the channel it was called in.

The calendar will automatically check for updates once an hour, but you can manually use `!update` to pull any updates.


### 5. Restrict Usage of Niles to admin/schduler Roles

You can create a role, or use an existing one and restrict the usage of Niles to that role.

i.e. create the role "Scheduler", assign it to yourself and others you want to have access, then enter:

 `admin Scheduler`

 Note that you MUST have the role you're trying to assign, the above is case sensitive.

You can give everyone permissions again by using the command:

 `admin everyone`

### 6. Customise display options (optional)

By default Niles will append a quick help menu to your calendar.

You can toggle this by using `!displayoptions help 0/1`

i.e. `!displayoptions help 0` will hide the help message on the next update / calendar pull.
