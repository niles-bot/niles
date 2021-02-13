---
layout: default
title: Getting Started
last_modified_date: true
nav_order: 2
---

# Getting Started
{: .no_toc }

## Steps
{: .no_toc .text-delta}

1. TOC
{:toc}

---

## Invite Niles to your server

[Invite Niles](https://discord.com/oauth2/authorize?client_id=320434122344366082&scope=bot&permissions=523344){: .btn}

---
## Google Calendar Authentication
### Differences between Service Account and OAuth2
Summary:

OAuth2
- Acts on your behalf, with access to **all of your calendars**

Service Accounts
- Acts as itself, with access to specified calendars
- Can no longer receive shared calendars

Service Accounts
- Allows per-calendar permissions
- Allow read-only or read-write permissions
- Extremely prone to errors or limited by Google (As of Jan 17, 2021)
- Events created by Service Account (Niles)

OAuth2
- Only allows permissions for ALL calendars for authorized accounts [Reference](https://developers.google.com/identity/protocols/oauth2/scopes#calendar)
- Expires and invalidated if not used for 6 months
- Does not require ownership or share permissions on calendars
- Events created by (Person)

[More Information on OAuth2](https://developers.google.com/identity/protocols/oauth2)

### Adding via Service Account

Select or create a [Google Calendar](https://calendar.google.com), and select 'Settings and sharing'
{: .pb-4 }

![gcalexample](../../assets/images/gcal-example-0.gif)
{: .text-center .pb-4 }

Scroll down and under 'Share with specific people', add `niles-291@niles-169605.iam.gserviceaccount.com` and give permissions to `Make changes to events`
{: .pb-4 }

![gcalexample](../../assets/images/gcal-example-1.gif)
{: .text-center}

### Warning
The only way to add Niles to your Google Calendar is through acl.insert. You can try it at [Google API Explorer](https://developers.google.com/calendar/v3/reference/acl/insert)
This method is tested, but unsupported and may break at any time without notice. 

### Adding via Oauth2

If you have OAuth2 credentials installed, run `!auth oauth2` and follow the link to authorize Niles to access your calendars.

---

## Add Google Calendar to your Niles Configuration

Still on the 'Settings and sharing' page, scroll down to 'Integrate Calendar' and copy the calendar ID.
{: .pb-4 }

![gcalidexample](../../assets/images/gcal-example-2.png)
{: .text-center .pb-4 }

Now in your Discord server (in a channel where Niles will have permissions, i.e. #general or another channel you have setup) we can use `!id` with the usage `!id calendarID` i.e:

`!id qb9t3fb6mn9p52a4re0hc067d8@group.calendar.google.com`

![discord-calendar-id-example](../../assets/images/discord-calendar-id.gif)
{: .text-center}

---

## Configure Timezone

We could pull this from your Google calendar or Discord server, but since your members might be in different timezones, you must add your own.

This can be done using `!tz` i.e.

`!tz America/New_York`
`!tz UTC+5`
`!tz EST`

![discord-tz-example](../../assets/images/discord-tz.gif)
{: .text-center}

[Full list of TZ database names on Wikipedia](https://cutt.ly/tz)

---

## Run your calendar for the first time!

Great now we can tell Niles to pull events from our GCal, setting up the database and display our calendar.

`!display` - Displays the calendar WITHOUT deleting any messages.

Both methods pin the current calendar to the channel it was called in.

The calendar will automatically check for updates every 5 minutes, but you can manually use `!update` to pull any updates.

![discord-display-example](../../assets/images/discord-display.gif)
{: .text-center }

---

## Customise it

You can change the way Niles looks and behaves, depending on your needs. See the [detailed customisation documentation](../customisation).

---

## Warnings

### GSuite/Workplace
If Niles is unable to find your calendar and you are under a GSuite / Google Workplace account, it's possible that the administrator has limited external sharing.

Google has a help article on how to enable external sharing  
https://support.google.com/a/answer/60765?hl=en

### New Calendar Format
Google Calendar has a new format for calendar IDs  
eg. `CAL1_qb9t3fb6mn9p52a4re0hc067d8@group.calendar.google.com`

If your calendar isn't found, remove the `CAL1_` portion - everything before and including the underscore
