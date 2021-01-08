---
layout: default
title: Customisation
nav_order: 4
---

# Customisation
{: .no_toc }

---

## Display Options

Use display options (!displayoptions) to customise the way the calendar appears in your Discord server.

| Display Option                                       | Usage                               | Description                                              |
|:-----------------------------------------------------|-------------------------------------|----------------------------------------------------------|
| [help](#calendar-help-message)                       | `!displayoptions help 0|1`          | Hide/show help message                                   |
| [pin](#pin-calendar-to-channel)                      | `!displayoptions pin 0|1`           | Disable/enable pinning                                   |
| [format](#time-format)                               | `!displayoptions format 12|24`      | 12h or 24h time display                                  |
| [tzdisplay](#display-timezone)                       | `!displayoptions tzdisplay 0|1`     | Hide/show timezone                                       |
| [emptydays](#hideshow-empty-days)                    | `!displayoptions emptydays 0|1 `    | Hide/show empty days                                     |
| [showpast](#hideshow-past-events-on-today)           | `!displayoptions showpast 0|1`      | Hide/show past events on Today                           |
| [trim](#trim-event-names-to-fixed-length)            | `!displayoptions trim <n>`          | Trim event names to length *n* (0 = off)                 |
| [days](#increasedecrease-number-of-days-on-calendar) | `!displayoptions days <n>`          | Number of days to display (Max. 25)                      |
| [style](#change-the-calendar-style)                  | `!displayoptions style code|embed`  | Use code (old) or embed (new) display styles             |
| [inline](#make-embed-style-calendar-inline)          | `!displayoptions inline 0|1`        | Makes embed display style use inline fields              |
| [description](#hideshow-event-description)           | `!displayoptions description 0|1`   | Hide/show event descriptions (embed calendar style only) |


---

### Calendar Help Message

By default Niles displays a verbose message to help new users interact with the bot.
This message can be toggled using `!displayoptions help 0|1` where 0 is off and 1 is on.

---

### Pin Calendar to Channel

By default, Niles will pin the calendar to the channel so it can be easily found. You can toggle this behaviour using `!displayoptions pin 0|1`.

---

### Time Format

Change the format between using 12 or 24 hour time.
12 hour time: 11:00 AM - 3:00 PM
24 hour time: 11:00 - 15:00

Use `!displayoptions format 12` or `!displayoptions format 24`

---

### Display Timezone

Use `!displayoptions !tzdisplay 1|0` to toggle the displaying of the timezone underneath the main calendar.

---

### Hide/Show Empty Days

Use `!displayoptions emptydays 0|1` to toggle whether days without events are shown or hidden.

Example Calendar with empty days *hidden*:

![displayoptions-emptydays](../../assets/images/emptydays.png)
{: .text-center }

---

### Hide/Show Past Events on Today

Use `!displayoptions showpast 0|1` to toggle if events past the current time but on the current day are hidden or shown.
i.e. use `!displayoptions showpast 0` to hide **Zoom Fitness Session** on Monday, from 9:00AM-10:00AM after 10AM on Monday.

---

### Trim Event Names to Fixed Length

Use `!displayoptions trim <n>` to trim the names of all events to the length `n`.  This may be useful if you have long event names but want to keep your Calendar looking tidy.  You can also use this option to reduce the length of your calendar if you are hitting the Discord character length limitations (2048 characters or 6000 characters depending on display style, see below).

---

### Increase/Decrease Number of Days on Calendar

Use `!displayoptions days <n>` to choose the number of days that the calendar displays *(Default = 7)*.
Keep in mind the following Discord limitations:
- Code [Default] style calendar - 2048 character limit per calendar
- Embed style calendar - 6000 character limit per embed

See below for details on calendar styles.

Example embed style calendar `!displayoptions days 14`:

![displayoptions-days](../../assets/images/moredays.png)
{: .text-center }

---

### Change the Calendar Style

There are two supported display styles for Niles:
- Code *(default)*
- Embed

You can change between them using the `!displayoptions style code|embed`

Example code style calendar (`!displayoptions style code`):

![codecalendar](../../assets/images/codestyle.png)
{: .text-center }

Example embed style calendar (`!displayoptions style embed`):

![embedcalendar](../../assets/images/embedstyle.png)
{: .text-center }

Keep in mind the following Discord limitations:
- Code [Default] style calendar - 2048 character limit per calendar
- Embed style calendar - 6000 character limit per embed

---

### Make Embed-Style Calendar 'Inline'

If you are using the embed style calendar then you can use 'inline fields' to change how the days are displayed.

Use `!displayoptions inline 0|1` (default = 0) to toggle this option.

Example embed style calendar with inline fields (`!displayoptions inline 1`):

![inlinefields](../../assets/images/inlinefields.png)
{: .text-center }

---

### Hide/Show Event Description

If you are using embed style calendar, you can enable/disable displaying of event descriptions.

Use `!displayoptions description 0|1` to toggle this off/on.  The descriptions will be as per the description field in Google Calendar.
