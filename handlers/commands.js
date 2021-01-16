const defer = require("promise-defer");
const CalendarAPI = require("@mchangrh/node-google-calendar");
const columnify = require("columnify");
const os = require("os");
const { DateTime, Duration }  = require("luxon");
const strings = require("./strings.js");
let bot = require("../bot.js");
let settings = require("../settings.js");
let init = require("./init.js");
let helpers = require("./helpers.js");
let guilds = require("./guilds.js");
let cal = new CalendarAPI(settings.calendarConfig);
let autoUpdater = [];
let timerCount = [];
let eventType = helpers.eventType;

//functions
/**
 * Cleans messages from the channel
 * @param {Snowflake} channel - channel to delete the messages in
 * @param {Integer} numberMessages - number of messages to delete
 * @param {bool} recurse - recursively delete messages
 */
function clean(channel, numberMessages, recurse) {
  let calendar = helpers.getGuildSettings(channel.guild.id, "calendar");
  channel.messages.fetch({
    limit: numberMessages
  }).then((messages) => { //If the current calendar is deleted
    messages.forEach(function(message) {
      if (message.id === calendar.calendarMessageId) {
        calendar.calendarMessageId = "";
        helpers.writeGuildSpecific(channel.guild.id, calendar, "calendar");
        clearInterval(autoUpdater[channel.guild.id]);
        try {
          delete timerCount[channel.guild.id];
          channel.send("update timer has been killed.");
        } catch (err) {
          helpers.log(err);
        }
      }
    });
    if (messages.size < 2) {
      channel.send("cleaning"); //Send extra message to allow deletion of 1 message.
      clean(channel, 2, false);
    }
    if (messages.size === 100 && recurse) {
      channel.bulkDelete(messages).catch((err) => {
        if(err.code===50034) {
          channel.send("Sorry - Due to Discord limitations, Niles cannot clean messages older than 14 days!");
        }
        helpers.log(`clean error in guild ${channel.guild.id} ${err}`);
      });
      clean(channel, 100, true);
    } else {
      channel.bulkDelete(messages).catch((err) => {
        if(err.code===50034) {
          channel.send("Sorry - Due to Discord limitations, Niles cannot clean messages older than 14 days!");
        }
        helpers.log(`clean error in guild ${channel.guild.id} ${err}`);
      });
    }
  }).catch((err) => {
    helpers.log(`clean error in guild: ${channel.guild.id} : ${err}`);
  });
}

/**
 * INterface to warn users before deleting messages
 * @param {Snowflake} message - Message sent by user
 * @param {[String]} args - arguments passed in 
 */
function deleteMessages(message, args) {
  let numberMessages = 0;
  const argMessages = parseInt(args[0], 10);
  const recurse = false;
  if (!args[0] || isNaN(argMessages)) {
    //Disable recursion for a while - causing bulk delete errors.
    //message.channel.send("**WARNING** - This will delete all messages in this channel! Are you sure? **(y/n)**");
    //numberMessages = 97;
    //recurse = true;
    return message.channel.send("You can only use a number to delete messages. i.e. `!clean 10`");
  } else if (argMessages < 100) {
    message.channel.send(`**WARNING** - This will delete ${argMessages} messages in this channel! Are you sure? **(y/n)**`);
    numberMessages = argMessages;
  } else if (argMessages === 100) {
    message.channel.send("**WARNING** - This will delete 100 messages in this channel! Are you sure? **(y/n)**");
    numberMessages = 97;
  }
  const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, {
    time: 30000
  });
  collector.on("collect", (m) => {
    if (m.content.toLowerCase() === "y" || m.content.toLowerCase() === "yes") {
      clean(message.channel, numberMessages + 3, recurse);
    } else {
      message.channel.send("Okay, I won't do that.");
      clean(message.channel, 4, false);
    }
    return collector.stop();
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") {
      message.channel.send("Command response timeout");
      clean(message.channel, 3, 0);
    }
  });
}

/**
 * Safely deletes update timer
 * @param {Snowflake} guildid - guild to remove from timers
 */
function killUpdateTimer(guildid) {
  clearInterval(autoUpdater[guildid]);
  try {
    delete timerCount[guildid];
  } catch (err) {
    helpers.log(err);
  }
}

/**
 * Creates daymap or use in other functions.
 * Standardized way of represending an array of days
 * Indexed by day[x] - x being integer starting from 0
 * Can be populated with events from GCal to create calendar.json file
 * @param {Snowflake} guildid - guild ID to pull from
 */
function createDayMap(guildid) {
  let dayMap = [];
  let tz = helpers.getValidTz(guildid);
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  // allowing all days to be correctly TZ adjusted
  let d = DateTime.fromJSDate(new Date()).setZone(tz);
  // if Option to show past events is set, start at startOf Day instead of NOW()
  if(guildSettings.showpast === "1") {
    d = d.startOf("day");
  }
  dayMap[0] =  d;
  for (let i = 1; i < guildSettings.days; i++) {
    dayMap[i] = d.plus({ days: i }); //DateTime is immutable, this creates new objects!
  }
  return dayMap;
}

/**
 * Get Events from Google Calendar
 * @param {Snowflake} message - message from user 
 * @param {String} calendarID - calendar ID to fetch from
 * @param {daymap} dayMap - dayMap to create events from
 */
function getEvents(message, calendarID, dayMap) {
  const guildid = message.guild.id;
  try {
    let oldCalendar = helpers.getGuildSettings(guildid, "calendar");
    let calendar = (({ lastUpdate, calendarMessageId }) => ({ lastUpdate, calendarMessageId }))(oldCalendar);
    let tz = helpers.getValidTz(guildid);
    let params = {
      timeMin: dayMap[0].toISO(),
      timeMax: dayMap[dayMap.length-1].endOf("day").toISO(), // get all events of last day!
      singleEvents: true,
      orderBy: "startTime",
      timeZone: tz
    };
    let matches = [];

    cal.Events.list(calendarID, params).then((json) => {
      for (let day = 0; day < dayMap.length; day++) {
        let key = "day" + String(day);
        matches = [];

        for (let i = 0; i < json.length; i++) {
          let eStartDate;
          let eEndDate;
          //Handle dateTime-based Events
          if (json[i].start.dateTime) {
            eStartDate = DateTime.fromISO(json[i].start.dateTime, {setZone: true});
            eEndDate = DateTime.fromISO(json[i].end.dateTime, {setZone: true});
          }
          //Handle All Day Events
          else if (json[i].start.date) {
            eStartDate = DateTime.fromISO(json[i].start.date, {zone: tz});
            // remove a day, since all-day end is start+1, we want to keep compatible with multi-day events though
            eEndDate = DateTime.fromISO(json[i].end.date, {zone: tz}).minus({days: 1});
          }

          let eType = helpers.classifyEventMatch(dayMap[day], eStartDate, eEndDate);
          if (eType !== eventType.NOMATCH) {
            matches.push({
              id: json[i].id,
              summary: json[i].summary,
              start: json[i].start,
              end: json[i].end,
              description: json[i].description,
              location: json[i].location,
              type: eType
            });
          }
          calendar[key] = matches;
        }
      }
      let d = new Date();
      calendar.lastUpdate = d;
      helpers.writeGuildSpecific(guildid, calendar, "calendar");
    }).catch((err) => {
      if (err.message.includes("notFound")) {
        helpers.log(`function getEvents error in guild: ${guildid} : 404 error can't find calendar`);
        message.channel.send(strings.NO_CALENDAR_MESSAGE);
        return killUpdateTimer(guildid);
      } else if (err.message.includes("Invalid Credentials")) { //Catching periodic google rejections;
        return helpers.log(`function getEvents error in guild: ${guildid} : 401 invalid credentials`);
      } else {
        helpers.log(`Error in function getEvents in guild: ${guildid} : ${err}`);
      }
      message.channel.send("update timer has been killed.");
      killUpdateTimer(guildid);
    });
  } catch (err) {
    message.channel.send(err.code);
    return helpers.log(`Error in function getEvents in guild: ${guildid} : ${err}`);
  }
}

/**
 * Determines if a calendar is empty
 * @param {Snowflake} guildid - guild to pull calendar from
 * @param {dayMap} dayMap - daymap to reference agianst
 */
function isEmptyCalendar(guildid, dayMap) {
  let isEmpty = true;
  const calendar = helpers.getGuildSettings(guildid, "calendar");
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    if (calendar[key] && calendar[key].length) { // if key exists & has length in days
      isEmpty = false;
    }
  }
  return isEmpty;
}

/**
 * Create appropiate description
 * @param {Object} event - Event Resources from GCal 
 * @param {Object} guildSettings - guild settings
 */
function eventNameCreator(event, guildSettings) {
  const titleName = helpers.trimEventName(event.summary, guildSettings.trim);
  let urlPattern = new RegExp("(http|https)://(\\w+:{0,1}\\w*)?(\\S+)(:[0-9]+)?(/|/([\\w#!:.?+=&%!-/]))?");
  if (urlPattern.test(event.location) && guildSettings.url === "1") { // if location is url & setting is on
    return `[${titleName}](${event.location})`;
  } else {
    return titleName;
  }
}

/**
 * Generate codeblock messsage for calendar display
 * @param {Snowflake} guildid - guild to create for
 * @param {daymap} dayMap - dayMap to conform to
 */
function generateCalendarCodeblock(guildid, dayMap) {
  let calendar = helpers.getGuildSettings(guildid, "calendar");
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  let finalString = "";
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let sendString = "";
    sendString += "\n**" + dayMap[i].toLocaleString({ weekday: "long"}) + "** - "+ dayMap[i].toLocaleString({ month: "long", day: "2-digit" });
    if(guildSettings.emptydays === "0" && calendar[key].length === 0) {
      continue;
    }
    if (calendar[key].length === 0) {
      sendString += "```\n ```";
    } else {
      sendString += "```\n";
      // Map events for each day
      for (let m = 0; m < calendar[key].length; m++) {
        let options = {
          showHeaders: false,
          columnSplitter: " | ",
          columns: ["time", "events"],
          config: {
            time: {
              minWidth: (guildSettings.format === 24) ? 15 : 20,
              align: "center"
            },
            events: {
              minWidth: 30
            }
          }
        };
        let eventTitle = helpers.trimEventName(calendar[key][m].summary, guildSettings.trim);
        if (Object.keys(calendar[key][m].start).includes("date")) {
          let tempString = {};
          // no need for temp start/fin dates
          tempString["All Day"] = eventTitle;
          sendString += columnify(tempString, options) + "\n";
        } else if (Object.keys(calendar[key][m].start).includes("dateTime")) {
          let tempString = {};
          // keep the - centered depending on format option
          let tempStartDate = ((guildSettings.format === 24) ? "....." : "........");
          let tempFinDate = ((guildSettings.format === 24) ? "....." : "........");
          let tempStringKey = "";
          if(calendar[key][m].type === eventType.SINGLE || calendar[key][m].type === eventType.MULTISTART) {
            tempStartDate = helpers.getStringTime(calendar[key][m].start.dateTime, guildid);
          }
          if(calendar[key][m].type === eventType.SINGLE || calendar[key][m].type === eventType.MULTYEND) {
            tempFinDate = helpers.getStringTime(calendar[key][m].end.dateTime, guildid);
          }
          if(calendar[key][m].type === eventType.MULTIMID){
            tempStringKey = "All Day";
          }
          else
          {
            tempStringKey = tempStartDate + " - " + tempFinDate;
          }
          tempString[tempStringKey] = eventTitle;
          sendString += columnify(tempString, options) + "\n";
        }
      }
      sendString += "```";
    }
    finalString += sendString;
  }
  return finalString; // return finalstring to generateCalendar
}

/**
 * Generate embed for calendar display
 * @param {Snowflake} guildid - guild to create for
 * @param {daymap} dayMap - dayMap to conform to
 */
function generateCalendarEmbed(guildid, dayMap) {
  let calendar = helpers.getGuildSettings(guildid, "calendar");
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  // start formatting
  let fields = [];
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let tempValue = "";
    let fieldObj = {
      name: "**" + dayMap[i].toLocaleString({ weekday: "long" }) + "** - " + dayMap[i].toLocaleString({ month: "long", day: "2-digit"}),
      inline: (guildSettings.inline === "1")
    };
    if (guildSettings.emptydays === "0" && calendar[key].length === 0) {
      continue;
    }
    if (calendar[key].length === 0) {
      tempValue = "\u200b";
    } else {
      // Map events for each day
      for (let m = 0; m < calendar[key].length; m++) {
        const curEvent = calendar[key][m];
        let duration = "";
        if (Object.keys(curEvent.start).includes("date")) {
          // no need for temp start/fin dates
          duration = "All Day";
        } else if (Object.keys(curEvent.start).includes("dateTime")) {
          let tempStartDate;
          let tempFinDate;
          if (curEvent.type === eventType.SINGLE || curEvent.type === eventType.MULTISTART) {
            tempStartDate = helpers.getStringTime(curEvent.start.dateTime, guildid);
          }
          if (curEvent.type === eventType.SINGLE || curEvent.type === eventType.MULTYEND) {
            tempFinDate = helpers.getStringTime(curEvent.end.dateTime, guildid);
          }
          if (curEvent.type === eventType.MULTIMID) {
            duration = "All Day";
          } else {
            duration = tempStartDate + " - " + tempFinDate;
          }
        }
        // construct field object with summary + description
        // add link if there is a location
        let eventTitle = eventNameCreator(curEvent, guildSettings);
        let description = helpers.descriptionParser(curEvent.description);
        tempValue += `**${duration}** | ${eventTitle}\n`;
        // if we should add description
        if ((description !== "undefined") && (guildSettings.description === "1")) {
          tempValue += `\`${description}\`\n`;
        }
      }
    }
    // finalize field object
    fieldObj.value = tempValue;
    fields.push(fieldObj);
  }
  return fields; // return field array
}

/**
 * Generate calendar message
 * @param {Snowflake} message - Message that initiated change
 * @param {daymap} dayMap - daymap for corresponding guild
 */
function generateCalendar(message, dayMap) {
  const guildid = message.guild.id;
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  let p = defer();
  // create embed
  let embed = new bot.discord.MessageEmbed();
  embed.setTitle(guildSettings.calendarName);
  embed.setURL("https://calendar.google.com/calendar/embed?src=" + guildSettings.calendarID);
  embed.setColor("BLUE");
  embed.setFooter("Last update");
  embed.setTimestamp(new Date());
  // set description or fields
  if (isEmptyCalendar(guildid, dayMap)) {
    embed.setDescription("```No Upcoming Events```");
  } else if (guildSettings.style === "code") {
    embed.setDescription(generateCalendarCodeblock(guildid, dayMap));
    // character check
    //Handle Calendars Greater Than 2048 Characters Long
    if (embed.length>2048) {
      message.channel.send("Your total calendar length exceeds 2048 characters - this is a Discord limitation - Try reducing the length of your event names or total number of events");
      p.reject(2048);
      return p.promise;
    }
  } else if (guildSettings.style === "embed") {
    embed.fields = generateCalendarEmbed(guildid, dayMap);
  }
  // add other embeds after code
  if (guildSettings.helpmenu === "1") {
    embed.addField("USING THIS CALENDAR", "To create events use ``!create`` or ``!scrim`` followed by your event details i.e. ``!scrim xeno on monday at 8pm-10pm``\n\nTo delete events use``!delete <day> <start time>`` i.e. ``!delete monday 5pm``\n\nHide this message using ``!displayoptions help 0``\n\nEnter ``!help`` for a full list of commands.", false);
  }
  if (guildSettings.tzDisplay === "1") { // display timezone
    embed.addField("Timezone", guildSettings.timezone, false);
  }
  p.resolve(embed);
  return p.promise;
}

/**
 * Start update timer for guild mentioned
 * @param {Snowflake} message - Initiating Message
 */
function startUpdateTimer(message) {
  const guildid = message.guild.id;
  if (!timerCount[guildid]) {
    timerCount[guildid] = 0;
  }
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  let calendarID = guildSettings.calendarID;
  let dayMap = createDayMap(guildid);
  //Pull updates on set interval
  if (!autoUpdater[guildid]) {
    timerCount[guildid] += 1;
    helpers.log(`Starting update timer in guild: ${guildid}`);
    return autoUpdater[guildid] = setInterval(function func() {
      calendarUpdater(message, calendarID, dayMap, false);
    }, settings.secrets.calendar_update_interval);

  }
  if (autoUpdater[guildid]._idleTimeout !== settings.secrets.calendar_update_interval) {
    try {
      timerCount[guildid] += 1;
      helpers.log(`Starting update timer in guild: ${guildid}`);
      return autoUpdater[guildid] = setInterval(function func() {
        calendarUpdater(message, calendarID, dayMap, false);
      }, settings.secrets.calendar_update_interval);
    } catch (err) {
      helpers.log(`error starting the autoupdater ${err}`);
      killUpdateTimer(guildid);
    }
  } else {
    return helpers.log(`timer not started in guild: ${guildid}`);
  }
}

/**
 * Post calendar in message channel
 * @param {Snowflake} message - Initiating message
 * @param {daymap} dayMap - daymap of events to post 
 */
function postCalendar(message, dayMap) {
  const guildid = message.guild.id;
  try {
    let calendar = helpers.getGuildSettings(guildid, "calendar");
    let guildSettings = helpers.getGuildSettings(guildid, "settings");

    if (calendar.calendarMessageId) {
      message.channel.messages.fetch(calendar.calendarMessageId).then((message) => {
        message.delete();
      }).catch((err) => {
        if (err.code === 10008) {
          calendar.calendarMessageId = "";
          helpers.writeGuildSpecific(guildid, calendar, "calendar");
        }
        return helpers.log(`error fetching previous calendar in guild: ${guildid} : ${err}`);
      });
    }
    generateCalendar(message, dayMap).then((embed) => {
      if (embed === 2048) {
        return;
      }
      message.channel.send({
        embed
      }).then((sent) => {
        calendar.calendarMessageId = sent.id;
        if (guildSettings.pin === "1") {
          sent.pin();
        }
      });
    }).then(() => {
      setTimeout(function func() {
        helpers.writeGuildSpecific(guildid, calendar, "calendar");
        setTimeout(function func() {
          startUpdateTimer(message);
        }, 2000);
      }, 2000);
    }).catch((err) => {
      if(err===2048) {
        helpers.log(`function postCalendar error in guild: ${guildid} : ${err} - Calendar too long`);
      } else {
        helpers.log(`function postCalendar error in guild: ${guildid} : ${err}`);
      }
    });
  } catch (err) {
    message.channel.send(err.code);
    return helpers.log(`Error in post calendar in guild: ${guildid} : ${err}`);
  }
}

/**
 * Updates calendar
 * @param {Snowflake} message - Message
 * @param {dayMap} dayMap - daymap for guild
 * @param {bool} human - if command was initiated by a human
 */
function updateCalendar(message, dayMap, human) {
  const guildid = message.guild.id;
  let calendar = helpers.getGuildSettings(guildid, "calendar");
  if (typeof calendar === "undefined" || calendar.calendarMessageId === "") {
    message.channel.send("Cannot find calendar to update, maybe try a new calendar with `!display`");
    helpers.log(`calendar undefined in ${guildid}. Killing update timer.`);
    killUpdateTimer(guildid);
  }
  let messageId = calendar.calendarMessageId;
  message.channel.messages.fetch(messageId).then((m) => {
    generateCalendar(message, dayMap).then((embed) => {
      if (embed === 2048) {
        return;
      }
      m.edit({
        embed
      });
      if ((timerCount[guildid] === 0 || !timerCount[guildid]) && human) {
        startUpdateTimer(message);
      }
    });
  }).catch((err) => {
    helpers.log(`error fetching previous calendar message in guild: ${guildid} : ${err}`);
    //If theres an updater running try and kill it.
    try {
      clearInterval(autoUpdater[guildid]);
      try {
        delete timerCount[guildid];
        message.channel.send("update timer has been killed.");
      } catch (err) {
        helpers.log(err);
      }
    } catch (err) {
      helpers.log(err);
    }
    message.channel.send("I can't find the last calendar I posted. Use `!display` and I'll post a new one.");
    calendar.calendarMessageId = "";
    helpers.writeGuildSpecific(guildid, calendar, "calendar");
    return;
  });
}

/**
 * Adds an event to google calendar via quickAddEvents
 * @param {Snowflake} message - message initiated
 * @param {[String]} args - Arguments passed in 
 * @param {String} calendarId - Google Calendar ID
 */
function quickAddEvent(message, args, calendarId) {
  let p = defer();
  if (!args[0]) {
    return message.channel.send("You need to enter an argument for this command. i.e `!scrim xeno thursday 8pm - 9pm`")
      .then((m) => {
        m.delete({ timeout: 5000 });
      });
  }
  const text = args.join(" "); // join
  let params = {
    text
  };
  cal.Events.quickAdd(calendarId, params).then((resp) => {
    let promptDate = (resp.start.dateTime ? resp.start.dateTime : resp.start.date);
    message.channel.send(`Event \`${resp.summary}\` on \`${promptDate}\` has been created`).then((m) => {
      m.delete({ timeout: 5000 });
    });
    p.resolve(resp);
  }).catch((err) => {
    helpers.log(`function quickAddE error in guild: ${message.guild.id} : ${err}`);
    p.reject(err);
  });
  return p.promise;
}

/**
 * handle binary display options
 * @param {Object} guildSettings - guild settings 
 * @param {[String]} args - Arguments passed in
 * @param {Snowflake} message - callback message
 */
function displayOptionHelper(guildSettings, args, message) {
  const setting = args[0];
  const value = args[1];
  const optionName = {
    pin: "calendar pinning",
    tzDisplay: "calendar timezone display",
    emptydays: "calendar empty days",
    showpast: "display of today's past events"
  };
  if (value) {
    message.channel.send(value === "1" ? `Set ${optionName[setting]} on` : `Set ${optionName[setting]} off`);
    guildSettings[setting] = value; // set value
  } else {
    message.channel.send(`Please only use 0 or 1 for the **${optionName[setting]}** setting, (off or on)`);
  }
  return guildSettings;
}

/**
 * Handle embed display options
 * @param {Object} guildSettings - guild settings 
 * @param {[String]} args - Arguments passed in
 * @param {Snowflake} message - callback message
 */
function embedStyleHelper(guildSettings, args, message) {
  const setting = args[0];
  const value = args[1];
  // current option
  const curStyle = guildSettings.style;
  const optionName = {
    inline: "inline events",
    description: "display of descriptions",
    url: "embedded link"
  };
  if (curStyle === "code") { // if set to code, do not allow
    return message.channel.send("This displayoption is only compatible with the `embed` display style");
  } else if (value) { // if set to embed, set
    message.channel.send(value === "1" ? `Set ${optionName[setting]} on` : `Set ${optionName[setting]} off`);
    guildSettings[setting] = value; // set value
  } else { // if no response, prompt with customization
    message.channel.send(`Please only use 0 or 1 for the **${optionName[setting]}** setting, (off or on) - see https://nilesbot.com/customisation`);
  }
  return guildSettings;
}

/**
 * Change Display Options
 * @param {Snowflake} message
 * @param {[String]} args - args passed in
 */
function displayOptions(message, args) {
  const guildid = message.guild.id;
  const dispCmd = args[0];
  const dispOption = args[1];
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  const binaryDisplayOptions = [
    "pin", "tzdisplay", "emptydays", "showpast"
  ];
  const embedStyleOptions = [
    "inline", "description", "url"
  ];
  if (binaryDisplayOptions.includes(dispCmd)) {
    guildSettings = displayOptionHelper(guildSettings, args, message);
  } else if (dispCmd === "help") {
    if (dispOption) {
      guildSettings.helpmenu = dispOption;
      message.channel.send(guildSettings.helpmenu === "1" ? "Set calendar help menu on" : "Set calendar help menu off");
    } else {
      message.channel.send("Please only use 0 or 1 for the calendar help menu setting, (off or on)");
    }
  } else if (dispCmd === "format") {
    if (dispOption) {
      guildSettings.format = dispOption;
      message.channel.send(guildSettings.format === "12" ? "Set to 12-Hour clock format" : "Set to 24-Hour clock format");
    } else {
      message.channel.send("Please only use 12 or 24 for the clock display options");
    }
  } else if (dispCmd === "trim") {
    if (dispOption) {
      let size = parseInt(dispOption);
      guildSettings.trim = (isNaN(size) ? 0 : size); // set to 0 if invalid, otherwise take number
      message.channel.send(`Set trimming of event titles to ${size} (0 = off)`);
    } else  {
      message.channel.send("Please provide a number to trim event titles. (0 = off)");
    }
  } else if (dispCmd === "days") {
    if (dispOption) {
      let size = parseInt(dispOption);
      guildSettings.days = 
        isNaN(size) ? 7 // if not a number - default to 7
          : size > 25 ? 25 // discord field limit is 25
            : size; // otherwise defualt to size
      message.channel.send(`Changed days to display to: ${guildSettings.days} (you may have to use \`!displayoptions emptydays 0\`)`);
    } else {
      message.channel.send("Please provide a number of days to display. (7 = default, 25 = max)");
    }
  } else if (dispCmd === "style") {
    if (dispOption === "code") {
      // revert dependent options
      guildSettings.inline = "0";
      guildSettings.description = "0";
    }
    if (dispOption) {
      guildSettings.style = dispOption;
      message.channel.send(`Changed display style to \`${guildSettings.style}\``);
    } else {
      message.channel.send("Please only use code or embed for the style choice. (see nilesbot.com/customisation)");
    }
  } else if (embedStyleOptions.includes(dispCmd)) {
    guildSettings = embedStyleHelper(guildSettings, args, message);
  } else {
    message.channel.send(strings.DISPLAYOPTIONS_USAGE);
  }
  helpers.writeGuildSpecific(guildid, guildSettings, "settings");
}

/**
 * Delete specific event by ID
 * @param {String} eventId - ID of event to delete
 * @param {String} calendarId - ID of calendar to delete event form
 * @param {daymap} dayMap - daymap to fetch events from 
 * @param {Snowflake} message - message to update calendar according to 
 */
function deleteEventById(eventId, calendarId, dayMap, message) {
  let params = {
    sendNotifications: true
  };
  return cal.Events.delete(calendarId, eventId, params).then(() => {
    getEvents(message, calendarId, dayMap);
    setTimeout(function func() {
      updateCalendar(message, dayMap, true);
    }, 2000);
  }).catch((err) => {
    helpers.log(`function deleteEventById error in guild: ${message.guild.id} : ${err}`);
  });
}

/**
 * List events within date range
 * @param {Snowflake} message - Initiating message
 * @param {*} calendarId - ID of calendar to fetch from
 * @param {*} dayMap - daymap and number of days to fetch from
 */
function listSingleEventsWithinDateRange(message, calendarId, dayMap) {
  let eventsArray = [];
  let tz = helpers.getValidTz(message.guild.id);
  let startDate = dayMap[0].toISO();
  let endDate = dayMap[6].toISO();
  let params = {
    timeMin: startDate,
    timeMax: endDate,
    singleEvents: true,
    timeZone: tz
  };
  return cal.Events.list(calendarId, params)
    .then((json) => {
      for (let i = 0; i < json.length; i++) {
        let event = {
          id: json[i].id,
          summary: json[i].summary,
          location: json[i].location,
          start: json[i].start,
          end: json[i].end,
          status: json[i].status,
          description: json[i].description
        };
        eventsArray.push(event);
      }
      return eventsArray;
    }).catch((err) => {
      helpers.log("Error: listSingleEventsWithinDateRange", err.message);
    });
}

/**
 * Displays the next upcoming event in the calendar file
 * @param {Snowflake} message - Initiating messages
 * @param {String} calendarId - ID of calendar to fetch from
 * @param {daymap} dayMap - daymap and number of days to fetch from
 */
function nextEvent(message, calendarId, dayMap) {
  const tz = helpers.getValidTz(message.guild.id);
  const now = DateTime.local().setZone(tz);
  listSingleEventsWithinDateRange(message, calendarId, dayMap).then((resp) => {
    for (let i = 0; i < resp.length; i++) {
      var isoDate = resp[i].start.dateTime;
      var luxonDate = DateTime.fromISO(isoDate);
      if (luxonDate > now) { // make sure event happens in the future
        // description is passed in - option to be added
        // construct string
        const timeTo = luxonDate.diff(now).shiftTo("days", "hours", "minutes", "seconds").toObject();
        var timeToString = "";
        if (timeTo.days) timeToString += `${timeTo.days} days `;
        if (timeTo.hours) timeToString += `${timeTo.hours} hours `;
        if (timeTo.minutes) timeToString += `${timeTo.minutes} minutes`;
        return message.channel.send(`The next event is \`${resp[i].summary}\` in ${timeToString}`);
      }
    }
    // run if message not sent
    message.channel.send("No upcoming events within date range");
  }).catch((err) => {
    helpers.log(err);
  });
}

/**
 * Delete event on daymap with specific name
 * @param {Snowflake} message - Initiating Message
 * @param {[String]} args - command arguments
 * @param {String} calendarId - ID of calendar to pull events from
 * @param {daymap} dayMap - daymap and number of days to fetch from
 */
function deleteEvent(message, args, calendarId, dayMap) {
  if (!args[0]) {
    return message.channel.send("You need to enter an argument for this command. i.e `!scrim xeno thursday 8pm - 9pm`")
      .then((m) => {
        m.delete({ timeout: 5000 });
      });
  }
  const text = args.join(" "); // join
  listSingleEventsWithinDateRange(message, calendarId, dayMap).then((resp) => {
    for (let i = 0; i < resp.length; i++) {
      const curEvent = resp[i];
      if (curEvent.summary) {
        if (text.toUpperCase().trim() == curEvent.summary.toUpperCase().trim()) {
          let promptDate = (curEvent.start.dateTime ? curEvent.start.dateTime : curEvent.start.date);
          message.channel.send(`Are you sure you want to delete the event **${curEvent.summary}** on ${promptDate}? **(y/n)**`);
          helpers.yesThenCollector(message).then(() => { // collect yes
            deleteEventById(curEvent.id, calendarId, dayMap, message).then(() => {
              message.channel.send(`Event **${curEvent.summary}** deleted`).then((res) => {
                res.delete({ timeout: 10000 });
              });
            }).catch((err) => {
              helpers.log(err);
            });
          });
          return;
        }
      }
    }
    return message.channel.send("Couldn't find event with that name - make sure you use exactly what the event is named!").then((res) => {
      res.delete({ timeout: 5000 });
    });
  }).catch((err) => {
    helpers.log(err); //FIX THIS
    return message.channel.send("There was an error finding this event").then((res) => {
      res.delete({ timeout: 5000 });
    });
  });
}

/**
 * Fetches new events and then updates calendar for specified guild
 * @param {Snowflake} message 
 * @param {String} calendarId - Calendar ID to fetch from
 * @param {*} dayMap
 * @param {bool} human - if initiated by human
 */
function calendarUpdater(message, calendarId, dayMap, human) {
  const guildid = message.guild.id;
  try {
    dayMap = createDayMap(guildid);
    setTimeout(function func() {
      getEvents(message, calendarId, dayMap);
    }, 2000);
    setTimeout(function func() {
      updateCalendar(message, dayMap, human);
    }, 4000);
  } catch (err) {
    helpers.log(`error in autoupdater in guild: ${guildid} : ${err}`);
    killUpdateTimer(guildid);
  }
}

/**
 * Display current bot stats
 * @param {Snowflake} message 
 */
function displayStats(message) {
  bot.client.shard.fetchClientValues("guilds.cache.size").then((results) => {
    const usedMem = `${(process.memoryUsage().rss/1048576).toFixed()} MB`;
    const totalMem = (os.totalmem()>1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + " GB" : (os.totalmem() / 1048576).toFixed() + " MB");
    let embed = new bot.discord.MessageEmbed()
      .setColor("RED")
      .setTitle(`Niles Bot ${settings.secrets.current_version}`)
      .setURL("https://github.com/niles-bot/niles")
      .addField("Servers", `${results.reduce((acc, guildCount) => acc + guildCount, 0)}`, true)
      .addField("Uptime", Duration.fromObject({ seconds: process.uptime()}).toFormat("d:hh:mm:ss"), true)
      .addField("Ping", `${(bot.client.ws.ping).toFixed(0)} ms`, true)
      .addField("RAM Usage", `${usedMem}/${totalMem}`, true)
      .addField("System Info", `${process.platform} (${process.arch})\n${totalMem}`, true)
      .addField("Libraries", `[Discord.js](https://discord.js.org) v${bot.discord.version}\nNode.js ${process.version}`, true)
      .addField("Links", `[Bot invite](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${bot.client.user.id}) | [Support server invite](https://discord.gg/jNyntBn) | [GitHub](https://github.com/niles-bot/niles)`, true)
      .setFooter("Created by the Niles Bot Team");
    message.channel.send({ embed });
  }).catch((err) => {
    helpers.log(err);
  });
}

/**
 * Rename Calendar Name
 * @param {Snowflake} message - message that initiated it
 * @param {[String]} args - arguments passed in
 */
function calName(message, args) {
  let guildSettings = helpers.getGuildSettings(message.guild.id, "settings");
  let newCalName = args[0];
  if (!newCalName) { // no name passed inno
    return message.channel.send(`You are currently using \`${guildSettings.calendarName}\` as the calendar name. To change the name use \`${guildSettings.prefix}calname <newname>\` or \`@Niles calname <newname>\``);
  } else {
    newCalName = args.join(" "); // join
  }
  message.channel.send(`Do you want to set the calendar name to \`${newCalName}\` ? **(y/n)**`);
  helpers.yesThenCollector(message).then(() => {
    guildSettings.calendarName = newCalName;
    helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
    message.channel.send(`Changed calendar name to \`${newCalName}\``);
  }).catch((err) => {
    helpers.log(err);
  });
}

/**
 * Updater Deleter
 * safely deletes timer count and removes from autoupdater
 * @param {String} guildid - ID of guild to delete updates for
 */
exports.deleteUpdater = function(guildid) {
  clearInterval(autoUpdater[guildid]);
  try {
    delete timerCount[guildid];
  } catch (err) {
    helpers.log(err);
  }
};

/**
 * Get events delayed
 * @param {Snowflake} message - Message that initiated it
 * @param {String} calendarId - calendar ID to fetch from
 * @param {dayMap} dayMap - daymap to generate for
 */
function delayGetEvents(message, calendarId, dayMap) {
  setTimeout(function func() {
    getEvents(message, calendarId, dayMap);
  }, 1000);
}

/**
 * Run Commands
 * @param {Snowflake} message 
 */
function run(message) {
  const guildid = message.guild.id;
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  let calendarID = guildSettings.calendarID;
  let dayMap = createDayMap(guildid);
  const args = message.content.slice(guildSettings.prefix.length).trim().split(" ");
  // if mentioned return second object as command, if not - return first object as command
  let cmd = (message.mentions.has(bot.client.user.id) ? args.splice(0, 2)[1] : args.shift());
  cmd = cmd.toLowerCase();
  // check if author is admin
  const sentByAdmin = (message.author.id === settings.secrets.super_admin || settings.secrets.other_admin.includes(message.author.id));
  // start commands
  if (["ping"].includes(cmd)) {
    message.channel.send(`:ping_pong: !Pong! ${(bot.client.ws.ping).toFixed(0)}ms`).catch((err) => {
      helpers.log(err);
    });
  } else if (["help"].includes(cmd)) {
    message.channel.send(strings.HELP_MESSAGE);
  } else if (["invite"].includes(cmd)) {
    const inviteEmbed = {
      color: 0xFFFFF,
      description: `Click [here](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${bot.client.user.id}) to invite me to your server`
    };
    message.channel.send({ embed: inviteEmbed });
  } else if (["setup", "start", "id", "tz", "prefix", "admin"].includes(cmd)) {
    try {
      init.run(message);
    } catch (err) {
      helpers.log(`error trying to run init message catcher in guild: ${guildid} : ${err}`);
    }
  } else if (["init"].includes(cmd)) {
    message.channel.send("Resetting Niles to default");
    guilds.recreateGuild(message.guild);
  } else if (["clean", "purge"].includes(cmd)) {
    deleteMessages(message, args);
  } else if (["display"].includes(cmd)) {
    delayGetEvents(message, calendarID, dayMap);
    setTimeout(function func() {
      postCalendar(message, dayMap);
    }, 2000);
  } else if (["update", "sync"].includes(cmd)) {
    calendarUpdater(message, calendarID, dayMap, true);
  } else if (["create", "scrim"].includes(cmd)) {
    quickAddEvent(message, args, calendarID).then(() => {
      calendarUpdater(message, calendarID, dayMap, true);
    }).catch((err) => {
      helpers.log(`error creating event in guild: ${guildid} : ${err}`);
    });
  } else if (["displayoptions"].includes(cmd)) {
    displayOptions(message, args);
  } else if (["stats", "info"].includes(cmd)) {
    displayStats(message);
  } else if (["get"].includes(cmd)) {
    getEvents(message, calendarID, dayMap);
  } else if (["stop"].includes(cmd)) {
    killUpdateTimer(guildid);
  } else if (["delete"].includes(cmd)) {
    deleteEvent(message, args, calendarID, dayMap);
  } else if (["next"].includes(cmd)) {
    nextEvent(message, calendarID, dayMap);
  } else if (["count"].includes(cmd)) {
    const theCount = (!timerCount[guildid] ? 0 : timerCount[guildid]);
    message.channel.send(`There are ${theCount} timer threads running in this guild`);
  } else if (["timers"].includes(cmd)) {
    if (sentByAdmin) {
      return message.channel.send(`There are ${Object.keys(timerCount).length} timers running on shard ${bot.client.shard.ids}.`);
    }
  } else if (["reset"].includes(cmd)) {
    if (sentByAdmin) {
      let response = "";
      const shardNo = parseInt(args[0]); // check for valid shard
      if (isNaN(shardNo)) {
        response = "Invalid shard number"; // check for valid number
      } else {
        response = `Restarting shard ${shardNo}`;
        helpers.log(response);
        bot.client.shard.broadcastEval(`if (this.shard.ids.includes(${shardNo})) process.exit();`);
      }
      message.client.send(response);
    }
  } else if (["validate"].includes(cmd)) {
    helpers.validate(message, cal);
  } else if (["calname"].includes(cmd)) {
    calName(message, args);
  }
  message.delete({ timeout: 5000 });
}

module.exports = {
  run
};
