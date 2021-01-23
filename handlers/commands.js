const defer = require("promise-defer");
const columnify = require("columnify");
const os = require("os");
const { DateTime, Duration }  = require("luxon");
const strings = require("./strings.js");
let bot = require("../bot.js");
const settings = require("../settings.js");
const init = require("./init.js");
const helpers = require("./helpers.js");
const guilds = require("./guilds.js");
let autoUpdater = [];
let timerCount = [];
const eventType = helpers.eventType;
const {google} = require("googleapis");
const { oauth2, sa } = require("../settings.js");

//functions
/**
 * Get and store access token after promptiong for user authorization
 * @param {bool} force - force reauthentication
 * @param {String} guildid - ID of guild to pull settings from
 * @param {String} channelid - ID of channel to respond and listen from
 */
function getAccessToken(force, guildid, channelid) {
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  const channel = bot.client.channels.cache.get(channelid);
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
  });
  if (guildSettings.auth === "oauth" && !force) return channel.send("Already using OAuth, use `!auth oauth force` to force reauthentication");
  const authEmbed = {
    color: 0x0099e1,
    description: `Authorize Niles by visiting this [url](${authUrl})
    Send the code from the page:`
  };
  channel.send({ embed: authEmbed });
  const collector = channel.createMessageCollector({ time: 30000 });
  guildSettings.auth = "oauth";
  collector.on("collect", (m) => {
    oauth2.getToken(m.content, (err, token) => {
      if (err) return channel.send(`Error retrieving access token \`${err}\``);
      channel.send("Successfuly Authenticated");
      helpers.writeGuildSpecific(guildid, token, "token"); // store token for later
      helpers.writeGuildSpecific(guildid, guildSettings, "settings"); // set auth to oauth
    });
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") channel.send("Command response timeout");
  });
}

/**
 * Guide user through authentication setup
 * @param {[String]} args - Arguments passed in
 * @param {String} guildid - ID of guild to pull settings form
 * @param {String} channelid - ID of channel to respond to
 */
function setupAuth(args, guildid, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  if (args[0] === "oauth") {
    if (!oauth2) return channel.send("OAuth2 credentials not installed");
    getAccessToken((args[1] === "force"), guildid, channelid);
  } else if (args[0] === "sa") {
    if (!sa) return channel.send("SA credentials not installed");
    guildSettings.auth = "sa"; // set SA to true
    helpers.writeGuildSpecific(guildid, guildSettings, "settings");
    channel.send(`Invite \`${settings.saId}\` to 'Make changes to events' under the Permission Settings on the Google Calendar you want to use with Niles`);
  } else {
    channel.send("Set up authentication with `auth sa` or `auth oauth`. For details see https://nilesbot.com/start/#google-calendar-authentication");
  }
}

/**
 * Get Authentication from guild
 * @param {String} guildid - ID of guild to fetch auth for 
 */
function getAuth(guildid) {
  const guildSettings = helpers.getGuildSettings(guildid, "settings");
  if (guildSettings.auth === "oauth") {
    const token = helpers.getGuildSettings(guildid, "token");
    oauth2.setCredentials(token);
    return oauth2;
  } else { // default to SA if oauth2 failed too
    return sa;
  }
}

/**
 * Safely deletes update timer
 * @param {Snowflake} guildid - guild to remove from timers
 */
function killUpdateTimer(guildid) {
  guildid = String(guildid);
  clearInterval(autoUpdater[guildid]);
  try { delete timerCount[guildid]; }
  catch (err) { helpers.log(err); }
}

/**
 * Interface to warn users before deleting messages
 * @param {[String]} args - arguments passed in 
 * @param {Snowflake} message - Message sent by user
 */
function deleteMessages(args, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  const argMessages = parseInt(args[0], 10);
  if (!args[0] || isNaN(argMessages)) {
    return channel.send("You can only use a number to delete messages. i.e. `!clean 10`");
  } else {
    channel.send(`You are about to delete ${argMessages} messages. Are you sure? (y/n)`);
    helpers.yesThenCollector(channelid).then(() => { // collect yes
      clean(channel, argMessages, args[1]);
    }).catch((err) => {
      helpers.log(err);
    });
  }
}

/**
 * Cleans messages from the channel
 * @param {Snowflake} channel - channel to delete the messages in
 * @param {Integer} numberMessages - number of messages to delete
 * @param {bool} recurse - recursively delete messages
 */
function clean(channel, numberMessages, deleteCal) {
  numberMessages += 3; // add 3 messages from collector
  const guildid = channel.guild.id;
  let calendar = helpers.getGuildSettings(guildid, "calendar");
  if (deleteCal) {
    // delete calendar id
    calendar.calendarMessageId = "";
    helpers.writeGuildSpecific(guildid, calendar, "calendar");
    killUpdateTimer(guildid);
    channel.bulkDelete(numberMessages, true); // delete messages
  } else {
    channel.messages.fetch({ limit: numberMessages
    }).then((messages) => { //If the current calendar is deleted
      messages.forEach(function(message) {
        if (message.id === calendar.calendarMessageId) messages.delete(message.id); // skip calendar message
      });
      channel.bulkDelete(messages, true);
    });
  }
}

/**
 * Creates daymap or use in other functions.
 * Standardized way of represending an array of days
 * Indexed by day[x] - x being integer starting from 0
 * Can be populated with events from GCal to create calendar.json file
 * @param {String} guildid - guild ID to pull from
 */
function createDayMap(guildid) {
  let dayMap = [];
  const tz = helpers.getValidTz(guildid);
  const guildSettings = helpers.getGuildSettings(guildid, "settings");
  // allowing all days to be correctly TZ adjusted
  let d = DateTime.fromJSDate(new Date()).setZone(tz);
  // if Option to show past events is set, start at startOf Day instead of NOW()
  if (guildSettings.showpast === "1") d = d.startOf("day");
  dayMap[0] =  d;
  for (let i = 1; i < guildSettings.days; i++) {
    dayMap[i] = d.plus({ days: i }); //DateTime is immutable, this creates new objects!
  }
  return dayMap;
}

/**
 * Get Events from Google Calendar
 * @param {String} channelid - channel ID to respond to
 */
function getEvents(channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  const guildid = channel.guild.id;
  const dayMap = createDayMap(guildid);
  const auth = getAuth(guildid);
  const oldCalendar = helpers.getGuildSettings(guildid, "calendar");
  const calendarID = helpers.getGuildSettings(guildid, "settings").calendarID;
  // construct calendar with old calendar file
  let calendar = (({ lastUpdate, calendarMessageId }) => ({ lastUpdate, calendarMessageId }))(oldCalendar);
  const tz = helpers.getValidTz(guildid);
  let params = {
    calendarId: calendarID,
    timeMin: dayMap[0].toISO(),
    timeMax: dayMap[dayMap.length-1].endOf("day").toISO(), // get all events of last day!
    singleEvents: true,
    orderBy: "startTime",
    timeZone: tz
  };
  const cal = google.calendar({version: "v3", auth});
  try {
    let matches = [];
    cal.events.list(params).then((res) => {
      for (let day = 0; day < dayMap.length; day++) {
        let key = "day" + String(day);
        matches = [];
        res.data.items.map((event) => {
          let eStartDate;
          let eEndDate;
          //Handle dateTime-based Events
          if (event.start.dateTime) {
            eStartDate = DateTime.fromISO(event.start.dateTime, {setZone: true});
            eEndDate = DateTime.fromISO(event.end.dateTime, {setZone: true});
          }
          //Handle All Day Events
          else if (event.start.date) {
            eStartDate = DateTime.fromISO(event.start.date, {zone: tz});
            // remove a day, since all-day end is start+1, we want to keep compatible with multi-day events though
            eEndDate = DateTime.fromISO(event.end.date, {zone: tz}).minus({days: 1});
          }
          let eType = helpers.classifyEventMatch(dayMap[day], eStartDate, eEndDate);
          if (eType !== eventType.NOMATCH) {
            matches.push({
              id: event.id,
              summary: event.summary,
              start: event.start,
              end: event.end,
              description: event.description,
              location: event.location,
              type: eType
            });
          }
          calendar[key] = matches;
        });
      }
      calendar.lastUpdate = new Date();
      helpers.writeGuildSpecific(guildid, calendar, "calendar");
    }).catch((err) => {
      if (err.message.includes("notFound")) {
        helpers.log(`function getEvents error in guild: ${guildid} : 404 error can't find calendar`);
        channel.send(strings.NO_CALENDAR_MESSAGE);
      } else if (err.message.includes("Invalid Credentials")) { // Catching periodic google rejections;
        return helpers.log(`function getEvents error in guild: ${guildid} : 401 invalid credentials`);
      } else {
        helpers.log(`Error in function getEvents in guild: ${guildid} : ${err}`);
      }
      channel.send("update timer has been killed.");
      killUpdateTimer(guildid);
    });
  } catch (err) {
    channel.send(err.code);
    return helpers.log(`Error in function getEvents in guild: ${guildid} : ${err}`);
  }
}

/**
 * Determines if a calendar is empty
 * @param {String} guildid - guild to pull calendar from
 * @param {dayMap} dayMap - daymap to reference agianst
 */
function isEmptyCalendar(guildid, dayMap) {
  let isEmpty = true;
  const calendar = helpers.getGuildSettings(guildid, "calendar");
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    // if key exists & has length in days
    if (calendar[key] && calendar[key].length) isEmpty = false;
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
  const urlPattern = new RegExp("(http|https)://(\\w+:{0,1}\\w*)?(\\S+)(:[0-9]+)?(/|/([\\w#!:.?+=&%!-/]))?");
  // if location is url & setting is on
  return ((urlPattern.test(event.location) && guildSettings.url === "1") ? `[${titleName}](${event.location})` : titleName);
}

/**
 * Generate codeblock messsage for calendar display
 * @param {Snowflake} guildid - guild to create for
 */
function generateCalendarCodeblock(guildid) {
  const calendar = helpers.getGuildSettings(guildid, "calendar");
  const guildSettings = helpers.getGuildSettings(guildid, "settings");
  const dayMap = createDayMap(guildid);
  let finalString = "";
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let sendString = "";
    sendString += "\n**" + dayMap[i].toLocaleString({ weekday: "long"}) + "** - "+ dayMap[i].toLocaleString({ month: "long", day: "2-digit" });
    if (guildSettings.emptydays === "0" && calendar[key].length === 0) continue;
    if (calendar[key].length === 0) {
      sendString += "```\n ```";
    } else {
      sendString += "```\n";
      // Map events for each day
      calendar[key].map((event) => {
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
        let eventTitle = helpers.trimEventName(event.summary, guildSettings.trim);
        if (Object.keys(event.start).includes("date")) {
          let tempString = {};
          // no need for temp start/fin dates
          tempString["All Day"] = eventTitle;
          sendString += columnify(tempString, options) + "\n";
        } else if (Object.keys(event.start).includes("dateTime")) {
          let tempString = {};
          // keep the - centered depending on format option
          let tempStartDate = ((guildSettings.format === 24) ? "....." : "........");
          let tempFinDate = ((guildSettings.format === 24) ? "....." : "........");
          let tempStringKey = "";
          if(event.type === eventType.SINGLE || event.type === eventType.MULTISTART) {
            tempStartDate = helpers.getStringTime(event.start.dateTime, guildid);
          }
          if(event.type === eventType.SINGLE || event.type === eventType.MULTYEND) {
            tempFinDate = helpers.getStringTime(event.end.dateTime, guildid);
          }
          if(event.type === eventType.MULTIMID){
            tempStringKey = "All Day";
          }
          else {
            tempStringKey = tempStartDate + " - " + tempFinDate;
          }
          tempString[tempStringKey] = eventTitle;
          sendString += columnify(tempString, options) + "\n";
        }
      });
      sendString += "```";
    }
    finalString += sendString;
  }
  return finalString; // return finalstring to generateCalendar
}

/**
 * Generate embed for calendar display
 * @param {Snowflake} guildid - guild to create for
 */
function generateCalendarEmbed(guildid) {
  let calendar = helpers.getGuildSettings(guildid, "calendar");
  let guildSettings = helpers.getGuildSettings(guildid, "settings");  // start formatting
  const dayMap = createDayMap(guildid);
  let fields = [];
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let tempValue = "";
    let fieldObj = {
      name: "**" + dayMap[i].toLocaleString({ weekday: "long" }) + "** - " + dayMap[i].toLocaleString({ month: "long", day: "2-digit"}),
      inline: (guildSettings.inline === "1")
    };
    if (guildSettings.emptydays === "0" && calendar[key].length === 0) continue;
    if (calendar[key].length === 0) tempValue = "\u200b";
    else {
      // Map events for each day
      calendar[key].map((event) => {
        let duration = "";
        // no need for temp start/fin dates
        if (Object.keys(event.start).includes("date")) duration = "All Day";
        else if (Object.keys(event.start).includes("dateTime")) {
          let tempStartDate;
          let tempFinDate;
          if (event.type === eventType.SINGLE || event.type === eventType.MULTISTART) {
            tempStartDate = helpers.getStringTime(event.start.dateTime, guildid);
          }
          if (event.type === eventType.SINGLE || event.type === eventType.MULTYEND) {
            tempFinDate = helpers.getStringTime(event.end.dateTime, guildid);
          }
          if (event.type === eventType.MULTIMID) duration = "All Day";
          else duration = tempStartDate + " - " + tempFinDate;
        }
        // construct field object with summary + description
        // add link if there is a location
        let eventTitle = eventNameCreator(event, guildSettings);
        let description = helpers.descriptionParser(event.description);
        tempValue += `**${duration}** | ${eventTitle}\n`;
        // if we should add description
        if ((description) && (guildSettings.description === "1")) {
          tempValue += `\`${description}\`\n`;
        }
      });
    }
    // finalize field object
    fieldObj.value = tempValue;
    fields.push(fieldObj);
  }
  return fields; // return field array
}

/**
 * Generate calendar message
 * @param {String} guildid - Guild ID to fetch settings from
 * @param {String} channelid - Channel ID to generate in
 */
function generateCalendar(guildid, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  const dayMap = createDayMap(guildid);
  const guildSettings = helpers.getGuildSettings(guildid, "settings");
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
    embed.setDescription(generateCalendarCodeblock(guildid));
    //Handle Calendars Greater Than 2048 Characters Long
    if (embed.length>2048) {
      channel.send("Your total calendar length exceeds 2048 characters - this is a Discord limitation - Try reducing the length of your event names or total number of events");
      p.reject(2048);
      return p.promise;
    }
  } else if (guildSettings.style === "embed") {
    embed.fields = generateCalendarEmbed(guildid);
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
 * Fetches new events and then updates calendar for specified guild
 * @param {String} guildid - Guild to start agianst 
 * @param {String} channelid - channel to respond to
 * @param {bool} human - if initiated by human
 */
function calendarUpdater(guildid, channelid, human) {
  try {
    setTimeout(function func() {
      getEvents(channelid);
    }, 2000);
    setTimeout(function func() {
      updateCalendar(guildid, channelid, human);
    }, 4000);
  } catch (err) {
    helpers.log(`error in autoupdater in guild: ${guildid} : ${err}`);
    killUpdateTimer(guildid);
  }
}

/**
 * Start update timer for guild mentioned
 * @param {String} guildid - ID of guild to update
 * @param {String} channelid - ID of channel to callback to
 */
function startUpdateTimer(guildid, channelid) {
  if (!timerCount[guildid]) {
    timerCount[guildid] = 0;
  }
  //Pull updates on set interval
  if (!autoUpdater[guildid]) {
    timerCount[guildid] += 1;
    helpers.log(`Starting update timer in guild: ${guildid}`);
    return autoUpdater[guildid] = setInterval(function func() {
      calendarUpdater(guildid, channelid, false);
    }, settings.secrets.calendar_update_interval);
  }
  if (autoUpdater[guildid]._idleTimeout !== settings.secrets.calendar_update_interval) {
    try {
      timerCount[guildid] += 1;
      helpers.log(`Starting update timer in guild: ${guildid}`);
      return autoUpdater[guildid] = setInterval(function func() {
        calendarUpdater(guildid, channelid, false);
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
 * @param {String} guildid - Guild ID to post calendar in
 * @param {Snowflake} message - Initiating message
 */
function postCalendar(guildid, channelid) {
  let calendar = helpers.getGuildSettings(guildid, "calendar");
  const pin = helpers.getGuildSettings(guildid, "settings").pin;
  const channel = bot.client.channels.cache.get(channelid);
  try {
    if (calendar.calendarMessageId) {
      channel.messages.fetch(calendar.calendarMessageId).then((message) => {
        message.delete();
      }).catch((err) => {
        if (err.code === 10008) {
          calendar.calendarMessageId = "";
          helpers.writeGuildSpecific(guildid, calendar, "calendar");
        }
        return helpers.log(`error fetching previous calendar in guild: ${guildid} : ${err}`);
      });
    }
    generateCalendar(guildid, channelid).then((embed) => {
      if (embed === 2048) {
        return;
      }
      channel.send({
        embed
      }).then((sent) => {
        calendar.calendarMessageId = sent.id;
        if (pin === "1") sent.pin();
      });
    }).then(() => {
      setTimeout(function func() {
        helpers.writeGuildSpecific(guildid, calendar, "calendar");
        setTimeout(function func() {
          startUpdateTimer(guildid, channelid);
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
    channel.send(err.code);
    return helpers.log(`Error in post calendar in guild: ${guildid} : ${err}`);
  }
}

/**
 * Updates calendar
 * @param {String} guildid - Guild ID
 * @param {String} channelid - Channel to respond to
 * @param {bool} human - if command was initiated by a human
 */
function updateCalendar(guildid, channelid, human) {
  const channel = bot.client.channels.cache.get(channelid);
  let calendar = helpers.getGuildSettings(guildid, "calendar");
  if (typeof calendar === "undefined" || calendar.calendarMessageId === "") {
    channel.send("Cannot find calendar to update, maybe try a new calendar with `!display`");
    helpers.log(`calendar undefined in ${guildid}. Killing update timer.`);
    killUpdateTimer(guildid);
  }
  const messageId = calendar.calendarMessageId;
  channel.messages.fetch(messageId).then((m) => {
    generateCalendar(guildid, channelid).then((embed) => {
      if (embed === 2048) {
        return;
      }
      m.edit({
        embed
      });
      if ((timerCount[guildid] === 0 || !timerCount[guildid]) && human) {
        startUpdateTimer(guildid, channelid);
      }
    });
  }).catch((err) => {
    helpers.log(`error fetching previous calendar message in guild: ${guildid} : ${err}`);
    //If theres an updater running try and kill it.
    channel.send("update timer has been killed.");
    killUpdateTimer(guildid);
    channel.send("I can't find the last calendar I posted. Use `!display` and I'll post a new one.");
    calendar.calendarMessageId = "";
    helpers.writeGuildSpecific(guildid, calendar, "calendar");
    return;
  });
}

/**
 * Adds an event to google calendar via quickAddEvent
 * @param {[String]} args - Arguments passed in 
 * @param {String} guildid - Guild ID to work agianst
 * @param {String} channelid - ID of channel to callback to
 */
function quickAddEvent(args, guildid, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  if (!args[0]) { 
    return channel.send("You need to enter an argument for this command. i.e `!scrim xeno thursday 8pm - 9pm`");
  }
  const text = args.join(" "); // join
  const guildSettings = helpers.getGuildSettings(guildid, "settings");
  const params = {
    calendarId: guildSettings.calendarID,
    text: text
  };
  const auth = getAuth(guildid);
  const cal = google.calendar({version: "v3", auth});
  cal.events.quickAdd(params).then(res => {
    const promptDate = (res.data.start.dateTime ? res.data.start.dateTime : res.data.start.date);
    return channel.send(`Event \`${res.data.summary}\` on \`${promptDate}\` has been created`);
  }).catch((err) => {
    helpers.log(`function quickAddEvent error in guild: ${guildid} : ${err}`);
  });
}

/**
 * handle binary display options
 * @param {[String]} args - Arguments passed in
 * @param {Object} guildSettings - guild settings 
 * @param {Snowflake} channel - callback channel
 * @returns {Object} guild settings without or without changes
 */
function displayOptionHelper(args, guildSettings, channel) {
  const setting = args[0];
  const value = args[1];
  const optionName = {
    pin: {
      name: "pin",
      help: "calendar pinning",
    }, tzdisplay: {
      name: "tzDisplay",
      help: "calendar timezone display",
    }, emptydays: {
      name: "emptydays",
      help: "calendar empty days"
    },showpast: {
      name: "showpast",
      help: "display of today's past events"
    }, help: {
      name: "helpmenu",
      help: "calendar help menu"
    }
  };
  if (value) {
    channel.send(value === "1" ? `Set ${optionName[setting].name} on` : `Set ${optionName[setting].name} off`);
    guildSettings[optionName[setting].name] = value; // set value
  } else {
    channel.send(`Please only use 0 or 1 for the **${optionName[setting].help}** setting, (off or on)`);
  }
  return guildSettings;
}

/**
 * Handle embed display options
 * @param {[String]} args - Arguments passed in
 * @param {Object} guildSettings - guild settings 
 * @param {Snowflake} channel - callback channel
 * @returns {Object} modified or same guild settings
 */
function embedStyleHelper(args, guildSettings, channel) {
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
    channel.send("This displayoption is only compatible with the `embed` display style");
  } else if (value) { // if set to embed, set
    channel.send(value === "1" ? `Set ${optionName[setting]} on` : `Set ${optionName[setting]} off`);
    guildSettings[setting] = value; // set value
  } else { // if no response, prompt with customization
    channel.send(`Please only use 0 or 1 for the **${optionName[setting]}** setting, (off or on) - see https://nilesbot.com/customisation`);
  }
  return guildSettings;
}

/**
 * Change Display Options
 * @param {[String]} args - args passed in
 * @param {String} guildid - ID of guild to fetch settings for 
 * @param {String} channelid - ID of channel to respond to
 */
function displayOptions(args, guildid, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  const dispCmd = args[0];
  const dispOption = args[1];
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  const binaryDisplayOptions = [
    "pin", "tzdisplay", "emptydays", "showpast", "help"
  ];
  const embedStyleOptions = [
    "inline", "description", "url"
  ];
  if (binaryDisplayOptions.includes(dispCmd)) {
    guildSettings = displayOptionHelper(args, guildSettings, channel);
  } else if (embedStyleOptions.includes(dispCmd)) {
    guildSettings = embedStyleHelper(args, guildSettings, channel);
  } else if (dispCmd === "format") {
    if (dispOption) {
      guildSettings.format = dispOption;
      channel.send(guildSettings.format === "12" ? "Set to 12-Hour clock format" : "Set to 24-Hour clock format");
    } else {
      channel.send("Please only use 12 or 24 for the clock display options");
    }
  } else if (dispCmd === "trim") {
    if (dispOption) {
      let size = parseInt(dispOption);
      guildSettings.trim = (isNaN(size) ? 0 : size); // set to 0 if invalid, otherwise take number
      channel.send(`Set trimming of event titles to ${size} (0 = off)`);
    } else  {
      channel.send("Please provide a number to trim event titles. (0 = off)");
    }
  } else if (dispCmd === "days") {
    if (dispOption) {
      let size = parseInt(dispOption);
      guildSettings.days = 
        isNaN(size) ? 7 // if not a number - default to 7
          : size > 25 ? 25 // discord field limit is 25
            : size; // otherwise defualt to size
      channel.send(`Changed days to display to: ${guildSettings.days} (you may have to use \`!displayoptions emptydays 0\`)`);
    } else {
      channel.send("Please provide a number of days to display. (7 = default, 25 = max)");
    }
  } else if (dispCmd === "style") {
    if (dispOption === "code") {
      // revert dependent options
      guildSettings.inline = "0";
      guildSettings.description = "0";
    }
    if (dispOption) {
      guildSettings.style = dispOption;
      channel.send(`Changed display style to \`${guildSettings.style}\``);
    } else {
      channel.send("Please only use code or embed for the style choice. (see nilesbot.com/customisation)");
    }
  } else {
    channel.send(strings.DISPLAYOPTIONS_USAGE);
  }
  helpers.writeGuildSpecific(guildid, guildSettings, "settings");
}

/**
 * Delete specific event by ID
 * @param {String} eventId - ID of event to delete
 * @param {String} calendarId - ID of calendar to delete event form
 * @param {Snowflake} channel - callback channel
 */
function deleteEventById(eventId, calendarId, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  const guildid = channel.guild.id;
  const params = {
    calendarId,
    eventId,
    sendNotifications: true
  };
  const auth = getAuth(guildid);
  const cal = google.calendar({version: "v3", auth});
  return cal.events.delete(params).then(() => {
    getEvents(channelid);
    setTimeout(function func() {
      updateCalendar(guildid, channelid, true);
    }, 2000);
  }).catch((err) => {
    helpers.log(`function deleteEventById error in guild: ${guildid} : ${err}`);
  });
}

/**
 * List events within date range
 * @param {String} guildid - List events in guild
 */
function listSingleEventsWithinDateRange(guildid) {
  const dayMap = createDayMap(guildid);
  const calendarID = helpers.getGuildSettings(guildid, "settings").calendarID;
  const cal = google.calendar({version: "v3", auth: getAuth(guildid)});
  const params = {
    calendarId: calendarID,
    timeMin: dayMap[0].toISO(),
    timeMax: dayMap[6].toISO(),
    singleEvents: true,
    timeZone: helpers.getValidTz(guildid),
    orderBy: "startTime"
  };
  return cal.events.list(params);
}

/**
 * Displays the next upcoming event in the calendar file
 * @param {String} channelid - ID of channel to respond to
 * @returns {Snowflake} response with confirmation or failiure
 */
function nextEvent(guildid, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  const now = DateTime.local().setZone(helpers.getValidTz(guildid));
  listSingleEventsWithinDateRange(guildid).then((resp) => {
    for (const eventObj of resp.data.items) {
      let isoDate = eventObj.start.dateTime || eventObj.start.date;
      let luxonDate = DateTime.fromISO(isoDate);
      if (luxonDate > now) { // make sure event happens in the future
        // description is passed in - option to be added
        // construct string
        const timeTo = luxonDate.diff(now).shiftTo("days", "hours", "minutes", "seconds").toObject();
        let timeToString = "";
        if (timeTo.days) timeToString += `${timeTo.days} days `;
        if (timeTo.hours) timeToString += `${timeTo.hours} hours `;
        if (timeTo.minutes) timeToString += `${timeTo.minutes} minutes`;
        return channel.send(`The next event is \`${eventObj.summary}\` in ${timeToString}`);
      }
    }
    // run if message not sent
    return channel.send("No upcoming events within date range");
  }).catch((err) => {
    helpers.log(err);
  });
}

/**
 * Delete event on daymap with specific name
 * @param {[String]} args - command arguments
 * @param {String} chennelid - callback channel
 * @returns {Snowflake} command response
 */
function deleteEvent(args, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  if (!args[0]) {
    return channel.send("You need to enter an argument for this command. i.e `!scrim xeno thursday 8pm - 9pm`")
      .then((m) => {
        m.delete({ timeout: 5000 });
      });
  }
  const text = args.join(" "); // join
  const guildid = channel.guild.id;
  const calendarID = helpers.getGuildSettings(guildid, "settings").calendarID;
  listSingleEventsWithinDateRange(guildid).then((resp) => {
    for (const curEvent of resp.data.items) {
      if (curEvent.summary && text.toLowerCase().trim() === curEvent.summary.toLowerCase().trim()) {
        let promptDate = (curEvent.start.dateTime ? curEvent.start.dateTime : curEvent.start.date);
        channel.send(`Are you sure you want to delete the event **${curEvent.summary}** on ${promptDate}? **(y/n)**`);
        helpers.yesThenCollector(channelid).then(() => { // collect yes
          deleteEventById(curEvent.id, calendarID, channelid).then(() => {
            channel.send(`Event **${curEvent.summary}** deleted`).then((res) => {
              res.delete({ timeout: 10000 });
            });
          }).catch((err) => {
            helpers.log(err);
          });
        });
        return;
      }
    }
    return channel.send("Couldn't find event with that name - make sure you use exactly what the event is named!").then((res) => {
      res.delete({ timeout: 5000 });
    });
  }).catch((err) => {
    helpers.log(err);
    return channel.send("There was an error finding this event").then((res) => {
      res.delete({ timeout: 5000 });
    });
  });
}

/**
 * Returns pass or fail instead of boolean
 * @param {boolean} bool
 * @returns {String}
 */
function passFail(bool) {
  return (bool ? "Passed 🟢" : "Failed 🔴");
}

/**
 * Checks if the bot has all the nesseary permissions
 * @param {String} channelid - ID of channel to check
 * @returns {String} - returns missing permissions (if any)
 */
function permissionCheck(channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  const minimumPermissions = ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "EMBED_LINKS", "ATTACH_FILES", "READ_MESSAGE_HISTORY"];
  const botPermissions = channel.permissionsFor(bot.client.user).serialize(true);
  let missingPermissions = "";
  minimumPermissions.map((permission) => {
    if (!botPermissions[permission]) {
      missingPermissions += `\`${String(permission)} \``;
    }
  });
  return (missingPermissions ? missingPermissions : "None 🟢");
}

/**
 * Checks for any issues with guild configuration
 * @param {String} guilid - ID of guild to check agianst
 * @param {String} channelid - ID of channel to respond to
 * @returns {bool} - if calendar fetches successfully
 */
function validate(guildid, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  const guildSettings = helpers.getGuildSettings(guildid, "settings");
  const auth = getAuth(guildid);
  const cal = google.calendar({version: "v3", auth});
  const params = {
    calendarId: guildSettings.calendarID,
    timeMin: DateTime.local().toISO(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 1
  };
  let calTest = cal.events.list(params).then((res) => {
    const event = res.data.items[0];
    channel.send(`**Next Event:**
      **Summary:** \`${event.summary}\`
      **Start:** \`${event.start.dateTime || event.start.date }\`
      **Calendar ID:** \`${event.organizer.email}\`
    `);
    return true;
  }).catch((err) => {
    channel.send(`Error Fetching Calendar: ${err}`);
  });
  // basic check
  channel.send(`**Checks**:
    **Timezone:** ${passFail(helpers.validateTz(guildSettings.timezone))}
    **Calendar ID:** ${passFail(helpers.matchCalType(guildSettings.calendarID, channelid))}
    **Calendar Test:** ${passFail(calTest)}
    **Missing Permissions:** ${permissionCheck(channelid)}
    **Guild ID:** \`${guildid}\`
    **Shard:** ${bot.client.shard.ids}
  `);
}

/**
 * Display current bot stats
 * @param {String} channelid - ID of channel to reply to 
 */
function displayStats(channelid) {
  bot.client.shard.fetchClientValues("guilds.cache.size").then((results) => {
    const { version } = require("../package.json");
    const usedMem = `${(process.memoryUsage().rss/1048576).toFixed()} MB`;
    const totalMem = (os.totalmem()>1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + " GB" : (os.totalmem() / 1048576).toFixed() + " MB");
    let embed = new bot.discord.MessageEmbed()
      .setColor("RED")
      .setTitle(`Niles Bot ${version}`)
      .setURL("https://github.com/niles-bot/niles")
      .addField("Servers", `${results.reduce((acc, guildCount) => acc + guildCount, 0)}`, true)
      .addField("Uptime", Duration.fromObject({ seconds: process.uptime()}).toFormat("d:hh:mm:ss"), true)
      .addField("Ping", `${(bot.client.ws.ping).toFixed(0)} ms`, true)
      .addField("RAM Usage", `${usedMem}/${totalMem}`, true)
      .addField("System Info", `${process.platform} (${process.arch})\n${totalMem}`, true)
      .addField("Libraries", `[Discord.js](https://discord.js.org) v${bot.discord.version}\nNode.js ${process.version}`, true)
      .addField("Links", `[Bot invite](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${bot.client.user.id}) | [Support server invite](https://discord.gg/jNyntBn) | [GitHub](https://github.com/niles-bot/niles)`, true)
      .setFooter("Created by the Niles Bot Team");
    bot.client.channels.cache.get(channelid).send({ embed });
  }).catch((err) => {
    helpers.log(err);
  });
}

/**
 * Rename Calendar Name
 * @param {[String]} args - arguments passed in
 * @param {String} guildid - ID of guild to pull settings from
 * @param {String} channelid - ID of channel to respond to
 */
function calName(args, guildid, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  let newCalName = args[0];
  if (!newCalName) { // no name passed inno
    return channel.send(`You are currently using \`${guildSettings.calendarName}\` as the calendar name. To change the name use \`${guildSettings.prefix}calname <newname>\` or \`@Niles calname <newname>\``);
  } else {
    newCalName = args.join(" "); // join
  }
  channel.send(`Do you want to set the calendar name to \`${newCalName}\` ? **(y/n)**`);
  helpers.yesThenCollector(channelid).then(() => {
    guildSettings.calendarName = newCalName;
    helpers.writeGuildSpecific(guildid, guildSettings, "settings");
    channel.send(`Changed calendar name to \`${newCalName}\``);
  }).catch((err) => {
    helpers.log(err);
  });
}

/**
 * Sets current channel to be Calendar channel
 * @param {[String]} args - arguments passed in 
 * @param {String} guildid - ID of guild to pull settings from
 * @param {String} channelid - ID of channel to respond to
 */
function setChannel(args, guildid, channelid) {
  const channel = bot.client.channels.cache.get(channelid);
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  if (!args[0]) {
    const guildChannelId = guildSettings.channelid;
    if (guildChannelId) { // if existing channel
      const guildChannel = bot.client.channels.cache.get(guildChannelId);
      channel.send(`The current calendar channel is \`${guildChannel.name}\``);
    } else {
      channel.send("There is no current calendar channel set");
    }
    channel.send("Use `!channel set` or `channel delete` to set or delete the current \"Calendar\" Channel");
  } else if (args[0] === "delete") { // remove channel
    guildSettings.channelid = "";
    helpers.writeGuildSpecific(guildid, guildSettings, "settings");
    channel.send("Removed existing calendar channel");
  } else if (args[0] === "set") {
    channel.send(`This will make the channel with name \`${channel.name}\` the primary channel for the calendar. All new calendars and updates will target this channel until \`!channel delete\` is run. Are you sure? (y/n)`);
    helpers.yesThenCollector(channelid).then(() => {
      guildSettings.channelid = channelid;
      helpers.writeGuildSpecific(guildid, guildSettings, "settings");
    }).catch((err) => {
      helpers.log(err);
    });
  }
}

/**
 * Run Commands
 * @param {Snowflake} message 
 */
function run(message) {
  const guildid = message.guild.id;
  let guildSettings = helpers.getGuildSettings(guildid, "settings");
  const channelid = message.channel.id;
  const guildChannelid = (guildSettings.channelid ? guildSettings.channelid : channelid);
  let args = message.content.slice(guildSettings.prefix.length).trim().split(" ");
  // if mentioned return second object as command, if not - return first object as command
  let cmd = (message.mentions.has(bot.client.user.id) ? args.splice(0, 2)[1] : args.shift());
  args = (args ? args : []); // return empty array if no args
  cmd = cmd.toLowerCase();
  // check if author is admin
  const sentByAdmin = (settings.secrets.admins.includes(message.author.id));
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
    deleteMessages(args, channelid);
  } else if (["display"].includes(cmd)) {
    setTimeout(function func() {
      getEvents(guildChannelid);
    }, 1000);
    setTimeout(function func() {
      postCalendar(guildid, guildChannelid);
    }, 2000);
  } else if (["update", "sync"].includes(cmd)) {
    calendarUpdater(guildid, guildChannelid, true);
  } else if (["create", "scrim"].includes(cmd)) {
    quickAddEvent(args, guildid, channelid);
    calendarUpdater(guildid, guildChannelid, true);
  } else if (["displayoptions"].includes(cmd)) {
    displayOptions(args, guildid, channelid);
  } else if (["stats", "info"].includes(cmd)) {
    displayStats(channelid);
  } else if (["get"].includes(cmd)) {
    getEvents(channelid);
  } else if (["stop"].includes(cmd)) {
    killUpdateTimer(guildid);
  } else if (["delete"].includes(cmd)) {
    deleteEvent(args, channelid);
  } else if (["next"].includes(cmd)) {
    nextEvent(guildid, channelid);
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
    validate(guildid, channelid);
  } else if (["calname"].includes(cmd)) {
    calName(args, guildid, channelid);
  } else if (["auth"].includes(cmd)) {
    setupAuth(args, guildid, channelid);
  } else if (["channel"].includes(cmd)) {
    setChannel(args, guildid, channelid);
  }
  message.delete({ timeout: 5000 });
}

module.exports = {
  run,
  killUpdateTimer
};
