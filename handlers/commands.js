const defer = require("promise-defer");
const columnify = require("columnify");
const os = require("os");
const { DateTime, Duration }  = require("luxon");
const log = require("debug")("niles:cmd");
const strings = require("./strings.js");
let bot = require("../bot.js");
const settings = require("../settings.js");
const helpers = require("./helpers.js");
const guilds = require("./guilds.js");
let autoUpdater = [];
let timerCount = [];
const eventType = helpers.eventType;
const {google} = require("googleapis");
const { oauth2, sa } = require("../settings.js");

//functions
/**
 * Send message with deletion timeout
 * @param {Snowflake} channel - channel to send message in
 * @param {String} content - content of message
 * @param {Number} [timeout=5000] - time in milliseconds before message is deleted
 */
function send(channel, content, timeout=5000) {
  channel.send(content)
    .then((message) => {
      message.delete({ timeout });
    });
}

/**
 * Get and store access token after promptiong for user authorization
 * @param {bool} force - force reauthentication
 * @param {Guild} guild - Guild to pull settings from
 * @param {Snowflake} channel - channel to respond and listen to
 */
function getAccessToken(force, guild, channel) {
  log(`getAccessToken | ${guild.id}`);
  if (!oauth2) { return send(channel, "OAuth2 credentials not installed"); }
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.events"]
  });
  if (guild.getSetting("auth") === "oauth" && !force) {
    return send(channel, "Already using OAuth, use `!auth oauth force` to force reauthentication");
  }
  const authEmbed = {
    color: 0x0099e1,
    description: `Authorize Niles by visiting this [url](${authUrl})
    Send the code from the page:`
  };
  send(channel, { embed: authEmbed }, 30000 );
  const collector = channel.createMessageCollector({ time: 30000 });
  collector.on("collect", (m) => {
    oauth2.getToken(m.content, (err, token) => {
      if (err) return send(channel, `Error retrieving access token \`${err}\``);
      send(channel, "Successfuly Authenticated");
      guild.setSetting("auth", "oauth");
      guild.setToken(token);
    });
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") send(channel, "Command response timeout");
  });
}

/**
 * Guide user through authentication setup
 * @param {[String]} args - Arguments passed in
 * @param {Guild} guild - Guild to pull settings form
 * @param {Snowflake} channel - Channel to respond to
 * @returns {Snowflake} - message response
 */
function setupAuth(args, guild, channel) {
  log(`setupAuth | ${guild.id}`);
  if (args[0] === "oauth") {
    getAccessToken(args[1] === "force", guild, channel);
  } else if (args[0] === "sa") {
    if (!sa) return send(channel, "SA credentials not installed");
    guild.getSetting("auth", "sa");
    send(channel, `Invite \`${settings.saId}\` to 'Make changes to events' under the Permission Settings on the Google Calendar you want to use with Niles`, 10000);
  } else { send(channel, "Set up authentication with `auth sa` or `auth oauth`. For details see https://nilesbot.com/start/#google-calendar-authentication", 10000);
  }
}

/**
 * Safely deletes update timer
 * @param {String} guildID - guild to remove from timers
 */
function killUpdateTimer(guildID) {
  log(`killUpdateTimer | ${guildID}`);
  try { 
    clearInterval(autoUpdater[guildID]);
    delete timerCount[guildID];
  } catch (err) { helpers.log(err, `Guild: ${guildID}`); }
}

/**
 * Cleans messages from the channel
 * @param {Snowflake} channel - channel to delete the messages in
 * @param {Integer} numberMessages - number of messages to delete
 * @param {bool} deleteCal - delete calendar message
 */
function clean(channel, numMsg, deleteCal) {
  log(`clean | ${channel.guild.id}`);
  numMsg = ((numMsg <= 97) ? numMsg+= 3 : 100); // add 3 messages from collector
  const guild = new guilds.Guild(channel.guild.id);
  const guildCalendarMessageID = guild.getCalendar("calendarMessageId");
  if (deleteCal) {
    guild.setCalendarID(""); // delete calendar id
    killUpdateTimer(guild.id);
    channel.bulkDelete(numMsg, true); // delete messages
  } else {
    channel.messages.fetch({ limit: numMsg })
      .then((messages) => { //If the current calendar is deleted
        messages.forEach(function(message) {
          if (guildCalendarMessageID && message.id === guildCalendarMessageID) messages.delete(message.id); // skip calendar message
        });
        return channel.bulkDelete(messages, true);
      });
  }
}

/**
 * Interface to warn users before deleting messages
 * @param {[String]} args - arguments passed in 
 * @param {Snowflake} channel - Channel to clean
 */
function deleteMessages(args, channel) {
  const argMessages = Number(args[0]);
  const deleteCalendar = Boolean(args[1]);
  if (!args[0] || isNaN(argMessages)) {
    return channel.send("You can only use a number to delete messages. i.e. `!clean 10`");
  } else {
    channel.send(`You are about to delete ${argMessages} messages. Are you sure? (y/n)`);
    helpers.yesThenCollector(channel).then(() => { // collect yes
      return clean(channel, argMessages, deleteCalendar);
    }).catch((err) => {
      helpers.log(err);
    });
  }
}

/**
 * Get Events from Google Calendar
 * @param {Guild} guild - Guild to pull settings from
 * @param {Snowflake} channel - channel to respond to
 */
function getEvents(guild, channel) {
  log(`getEvents | ${guild.id}`);
  guild.update(); // update guild
  const dayMap = guild.getDayMap();
  const auth = guild.getAuth();
  const tz = guild.tz;
  const oldCalendar = guild.getCalendar();
  // construct calendar with old calendar file
  let calendar = (({ lastUpdate, calendarMessageId }) => ({ lastUpdate, calendarMessageId }))(oldCalendar);
  const params = {
    calendarId: guild.getSetting("calendarID"),
    timeMin: dayMap[0].toISO(),
    timeMax: dayMap[dayMap.length-1].endOf("day").toISO(), // get all events of last day!
    singleEvents: true,
    orderBy: "startTime",
    timeZone: tz
  };
  const gCal = google.calendar({version: "v3", auth});
  try {
    let matches = [];
    gCal.events.list(params).then((res) => {
      log(`getEvents - list | ${guild.id}`);
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
      guild.setCalendar(calendar);
    }).catch((err) => {
      log(`getEvents | ${guild.id} | ${err}`);
      if (err.message.includes("notFound")) {
        helpers.log(`function getEvents error in guild: ${guild.id} : 404 error can't find calendar`);
        channel.send(strings.NO_CALENDAR_MESSAGE);
      } else if (err.message.includes("Invalid Credentials")) { // Catching periodic google rejections;
        return helpers.log(`function getEvents error in guild: ${guild.id} : 401 invalid credentials`);
      } else {
        helpers.log(`Error in function getEvents in guild: ${guild.id} : ${err}`);
      }
      channel.send("update timer has been killed.");
      killUpdateTimer(guild.id);
    });
  } catch (err) {
    channel.send(err.code);
    return helpers.log(`Error in function getEvents in guild: ${guild.id} : ${err}`);
  }
}

/**
 * Determines if a calendar is empty
 * @param {Guild} guild - Guild to pull calendar from
 * @param {dayMap} dayMap - daymap to reference agianst
 */
function isEmptyCalendar(guild, dayMap) {
  log(`isEmptyCalendar | ${guild.id}`);
  let isEmpty = true;
  const guildCalendar = guild.getCalendar();
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    // if key exists & has length in days
    if (guildCalendar[key] && guildCalendar[key].length) isEmpty = false;
  }
  return isEmpty;
}

/**
 * Create appropiate description
 * @param {Object} event - Event Resources from GCal 
 * @param {Object} guildSettings - guild settings
 */
function eventNameCreator(event, guildSettings) {
  log("eventNameCreator");
  const titleName = helpers.trimEventName(event.summary, guildSettings.trim);
  const urlPattern = new RegExp("^https?://");
  // if location is url & setting is on
  const addURL = (urlPattern.test(event.location) && guildSettings.url === "1");
  log(`eventNameCreator | url: ${addURL}`);
  return (addURL ? `[${titleName}](${event.location})` : titleName);
}

/**
 * Generate codeblock messsage for calendar display
 * @param {Guild} guild - guild to create for
 */
function generateCalendarCodeblock(guild) {
  log(`generateCalendarCodeblock | ${guild.id}`);
  const guildCalendar = guild.getCalendar();
  const guildSettings = guild.getSetting();
  const dayMap = guild.getDayMap();
  let finalString = "";
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let sendString = "";
    sendString += "\n**" + dayMap[i].toLocaleString({ weekday: "long"}) + "** - "+ dayMap[i].toLocaleString({ month: "long", day: "2-digit" });
    if (guildSettings.emptydays === "0" && guildCalendar[key].length === 0) continue;
    if (guildCalendar[key].length === 0) {
      sendString += "```\n ```";
    } else {
      sendString += "```\n";
      // Map events for each day
      guildCalendar[key].map((event) => {
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
          // no need for temp start/fin dates
          const tempString = {"All Day": eventTitle};
          sendString += columnify(tempString, options) + "\n";
        } else if (Object.keys(event.start).includes("dateTime")) {
          // keep the - centered depending on format option
          let tempStartDate = ((guildSettings.format === 24) ? "....." : "........");
          let tempFinDate = ((guildSettings.format === 24) ? "....." : "........");
          let duration = "";
          if (event.type === eventType.SINGLE || event.type === eventType.MULTISTART) {
            tempStartDate = helpers.getStringTime(event.start.dateTime, guild);
          }
          if (event.type === eventType.SINGLE || event.type === eventType.MULTYEND) {
            tempFinDate = helpers.getStringTime(event.end.dateTime, guild);
          }
          if (event.type === eventType.MULTIMID) duration = "All Day";
          else duration = (guildSettings.startonly === "1" ? tempStartDate : tempStartDate + " - " + tempFinDate); // optionally only show start time
          const tempString = {[duration]: eventTitle};
          sendString += columnify(tempString, options) + "\n";
        }
      });
      sendString += "```";
    }
    finalString += sendString;
  }
  log(`generateCalendarCodeblock | ${guild.id}| finalString ${finalString}`);
  return finalString; // return finalstring to generateCalendar
}

/**
 * Generate embed for calendar display
 * @param {Guild} guild - guild to create for
 */
function generateCalendarEmbed(guild) {
  log(`generateCalendarEmbed | ${guild.id}`);
  let guildCalendar = guild.getCalendar();
  let guildSettings = guild.getSetting();
  const dayMap = guild.getDayMap();
  let msgLength = 0;
  let fields = [];
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let tempValue = "";
    let fieldObj = {
      name: "**" + dayMap[i].toLocaleString({ weekday: "long" }) + "** - " + dayMap[i].toLocaleString({ month: "long", day: "2-digit"}),
      inline: (guildSettings.inline === "1")
    };
    if (guildSettings.emptydays === "0" && guildCalendar[key].length === 0) continue;
    if (guildCalendar[key].length === 0) tempValue = "\u200b";
    else {
      // Map events for each day
      guildCalendar[key].forEach((event) => {
        let duration = "";
        // no need for temp start/fin dates
        if (Object.keys(event.start).includes("date")) duration = "All Day";
        else if (Object.keys(event.start).includes("dateTime")) {
          let tempStartDate = ((guildSettings.format === 24) ? "....." : "........");
          let tempFinDate = ((guildSettings.format === 24) ? "....." : "........");
          if (event.type === eventType.SINGLE || event.type === eventType.MULTISTART) {
            tempStartDate = helpers.getStringTime(event.start.dateTime, guild);
          }
          if (event.type === eventType.SINGLE || event.type === eventType.MULTYEND) {
            tempFinDate = helpers.getStringTime(event.end.dateTime, guild);
          }
          if (event.type === eventType.MULTIMID) duration = "All Day";
          else duration = (guildSettings.startonly === "1" ? tempStartDate : tempStartDate + " - " + tempFinDate); // optionally only show start time
        }
        // construct field object with summary + description
        // add link if there is a location
        const eventTitle = eventNameCreator(event, guildSettings);
        tempValue += `**${duration}** | ${eventTitle}\n`;
        // add title length to counter
        msgLength += eventTitle.length;
        // limitDescriptionLength
        const descLength = guildSettings.descLength;
        const description = helpers.descriptionParser(event.description);
        const trimmed = (descLength ? description.slice(0, descLength) : description);
        // if we should add description
        if ((description !== "undefined") && (guildSettings.description === "1")) {
          tempValue += `\`${trimmed}\`\n`;
          // add description length to counter
          msgLength += trimmed.length;
        }
      });
    }
    // finalize field object
    log(`generateCalendarEmbed | ${guild.id} | value ${tempValue}`);
    fieldObj.value = tempValue;
    fields.push(fieldObj);
  }
  // check if too many characters
  // 200 character buffer - 
  if (msgLength + 200 > 6000) {
    fields = [{
      "name": "Error: Calendar Too Long",
      "value": `Your calendar has over ${msgLength} characters. This must be under 6000, as mandated by Discord. Try \`displayoptions desclength\` to limit description length or \`displayoptions descriptions\` to toggle descriptions.`
    }];
  }
  return fields; // return field array
}

/**
 * Generate calendar message
 * @param {Guild} guild - Guild to fetch settings from
 * @param {String} channel - Channel to generate in
 */
function generateCalendar(guild, channel) {
  log(`generateCalendar | ${guild.id}`);
  const dayMap = guild.getDayMap();
  const guildSettings = guild.getSetting();
  let p = defer();
  // create embed
  let embed = new bot.discord.MessageEmbed()
    .setTitle(guildSettings.calendarName)
    .setURL("https://calendar.google.com/calendar/embed?src=" + guildSettings.calendarID)
    .setColor("BLUE")
    .setFooter("Last update")
    .setTimestamp();
  // set description or fields
  if (isEmptyCalendar(guild, dayMap)) {
    embed.setDescription("```No Upcoming Events```");
  } else if (guildSettings.style === "code") {
    embed.setDescription(generateCalendarCodeblock(guild));
    //Handle Calendars Greater Than 2048 Characters Long
    if (embed.length>2048) {
      channel.send("Your total calendar length exceeds 2048 characters - this is a Discord limitation - Try reducing the length of your event names or total number of events");
      p.reject(2048);
      return p.promise;
    }
  } else if (guildSettings.style === "embed") {
    embed.fields = generateCalendarEmbed(guild);
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
 * @param {String} guildID - ID of guild to update
 * @param {Snowflake} channel - Channel to callback to
 * @param {Guild} guild - Guild object
 */
function startUpdateTimer(guildID, channel, guild) {
  log(`startUpdateTimer | ${guildID}`);
  if (!timerCount[guildID]) {
    timerCount[guildID] = 0;
  }
  //Pull updates on set interval
  if (!autoUpdater[guildID]) {
    log(`startUpdateTimer | ${guildID} | no current AU`);
    timerCount[guildID] += 1;
    helpers.log(`Starting update timer in guild: ${guildID}`);
    return autoUpdater[guildID] = setInterval(function func() {
      calendarUpdater(guild, channel, false);
    }, settings.secrets.calendar_update_interval);
  }
  if (autoUpdater[guildID]._idleTimeout !== settings.secrets.calendar_update_interval) {
    log(`startUpdateTimer | ${guildID} | restart invalid timeout`);
    try {
      timerCount[guildID] += 1;
      helpers.log(`Starting update timer in guild: ${guildID}`);
      return autoUpdater[guildID] = setInterval(function func() {
        calendarUpdater(guild, channel, false);
      }, settings.secrets.calendar_update_interval);
    } catch (err) {
      helpers.log(`error starting the autoupdater ${err}`);
      killUpdateTimer(guildID);
    }
  } else {
    log(`startUpdateTimer | ${guildID} | not started`);
    return helpers.log(`timer not started in guild: ${guildID}`);
  }
}

/**
 * Updates calendar
 * @param {Guild} guild - Guild to fetch from
 * @param {Snowflake} channel - Channel to respond to
 * @param {bool} human - if command was initiated by a human
 */
function updateCalendar(guild, channel, human) {
  log(`updateCalendar | ${guild.id}`);
  guild.update(); // update guild
  const guildCalendarMessageID = guild.getCalendar("calendarMessageId");
  if (guildCalendarMessageID === "") {
    channel.send("Cannot find calendar to update, maybe try a new calendar with `!display`");
    helpers.log(`calendar undefined in ${guild.id}. Killing update timer.`);
    return killUpdateTimer(guild.id);
  }
  channel.messages.fetch(guildCalendarMessageID).then((m) => {
    generateCalendar(guild, channel).then((embed) => {
      if (embed === 2048) return null;
      m.edit({ embed });
      if ((timerCount[guild.id] === 0 || !timerCount[guild.id]) && human) {
        startUpdateTimer(guild.id, channel, guild);
      }
    });
  }).catch((err) => {
    log(`startUpdateTimer | ${err}`);
    helpers.log(`error fetching previous calendar message in guild: ${guild.id} : ${err}`);
    //If theres an updater running try and kill it.
    channel.send("update timer has been killed.");
    channel.send("I can't find the last calendar I posted. Use `!display` and I'll post a new one.");
    killUpdateTimer(guild.id);
    guild.setCalendarID("");
    return;
  });
}

/**
 * Fetches new events and then updates calendar for specified guild
 * @param {Guild} guild - Guild to start agianst 
 * @param {Snowflake} channel - channel to respond to
 * @param {bool} human - if initiated by human
 */
function calendarUpdater(guild, channel, human) {
  log(`calendarUpdater | ${guild.id}`);
  try {
    setTimeout(() => { getEvents(guild, channel); }, 2000);
    setTimeout(() => { updateCalendar(guild, channel, human); }, 4000);
  } catch (err) {
    helpers.log(`error in autoupdater in guild: ${guild.id} : ${err}`);
    killUpdateTimer(guild.id);
  }
}

/**
 * Post calendar in message channel
 * @param {Guild} guild - Guild to post relative to
 * @param {Snowflake} channel - Initiating channel
 */
function postCalendar(guild, channel) {
  log(`postCalendar | ${guild.id}`);
  const guildCalendarMessageID = guild.getCalendar("calendarMessageId");
  if (guildCalendarMessageID) {
    channel.messages.fetch(guildCalendarMessageID).then((message) => { message.delete();
    }).catch((err) => {
      if (err.code === 10008) guild.setCalendarID("");
      return helpers.log(`error fetching previous calendar in guild: ${guild.id} : ${err}`);
    });
  }
  generateCalendar(guild, channel).then((embed) => {
    if (embed === 2048) return null;
    channel.send({ embed
    }).then((sent) => {
      log(`startUpdateTimer | ${guild.id} | calID ${sent.id}`);
      guild.setCalendarID(sent.id);
      if (guild.getSetting("pin") === "1") sent.pin();
    });
  }).then(() => {
    setTimeout(() => { startUpdateTimer(guild.id, channel, guild); }, 2000);
  }).catch((err) => {
    if (err===2048) helpers.log(`function postCalendar error in guild: ${guild.id} : ${err} - Calendar too long`);
    else helpers.log(`function postCalendar error in guild: ${guild.id} : ${err}`);
  });
}

/**
 * Adds an event to google calendar via quickAddEvent
 * @param {[String]} args - Arguments passed in 
 * @param {Guild} guild - Guild to work agianst
 * @param {Snowflake} channel - Channel to callback to
 */
function quickAddEvent(args, guild, channel) {
  log(`startUpdateTimer | ${guild.id} | args ${args}`);
  if (!args[0]) return send(channel, "You need to enter an argument for this command. i.e `!scrim xeno thursday 8pm - 9pm`");
  const params = {
    calendarId: guild.getSetting("calendarID"),
    text: args.join(" ") // join
  };
  const gCal = google.calendar({version: "v3", auth: guild.getAuth()});
  gCal.events.quickAdd(params).then((res) => {
    const promptDate = (res.data.start.dateTime ? res.data.start.dateTime : res.data.start.date);
    return send(channel, `Event \`${res.data.summary}\` on \`${promptDate}\` has been created`);
  }).catch((err) => { helpers.log(`function quickAddEvent error in guild: ${guild.id} : ${err}`);
  });
}

/**
 * handle binary display options
 * @param {[String]} args - Arguments passed in
 * @param {Guild} guild - Guild object 
 * @param {Snowflake} channel - callback channel
 * @returns {Object} guild settings without or without changes
 */
function displayOptionHelper(args, guild, channel) {
  log(`displayOptionsHelper | ${guild.id} | args: ${args}`);
  const setting = args[0];
  const value = args[1];
  const optionName = {
    pin: {
      name: "pin",
      help: "calendar pinning"
    }, tzdisplay: {
      name: "tzDisplay",
      help: "calendar timezone display"
    }, emptydays: {
      name: "emptydays",
      help: "calendar empty days"
    },showpast: {
      name: "showpast",
      help: "display of today's past events"
    }, help: {
      name: "helpmenu",
      help: "calendar help menu"
    }, startonly: {
      name: "startonly",
      help: "start time only"
    }
  };
  if (value) {
    const settingName = optionName[setting].name;
    send(channel, value === "1" ? `Set ${settingName} on` : `Set ${settingName} off`);
    log(`displayOptionsHelper | ${guild.id} | setting: ${setting} | value: ${value}`);
    guild.setSetting(settingName, value); // set value
  } else { send(channel, `Please only use 0 or 1 for the **${optionName[setting].help}** setting, (off or on)`);
  }
}

/**
 * Handle embed display options
 * @param {[String]} args - Arguments passed in
 * @param {Guild} guild - Guild object 
 * @param {Snowflake} channel - callback channel
 */
function embedStyleHelper(args, guild, channel) {
  const setting = args[0];
  const value = args[1];
  // current option
  const curStyle = guild.getSetting("style");
  log(`embedStyleHelper | ${guild.id} | setting: ${setting} | value: ${value} | style: ${curStyle}`);
  const optionName = {
    inline: "inline events",
    description: "display of descriptions",
    url: "embedded link"
  };
  // if set to code, do not allow
  if (curStyle === "code") { send(channel, "This displayoption is only compatible with the `embed` display style");
  } else if (value) { // if set to embed, set
    send(channel, (value === "1" ? `Set ${optionName[setting]} on` : `Set ${optionName[setting]} off`));
    guild.setSetting(setting, value); // set value
  // if no response, prompt with customization
  } else { send(channel, `Please only use 0 or 1 for the **${optionName[setting]}** setting, (off or on) - see https://nilesbot.com/customisation`);
  }
}

/**
 * Change Display Options
 * @param {[String]} args - args passed in
 * @param {Guild} guild - Guild to fetch settings for 
 * @param {Snowflake} channel - Channel to respond to
 */
function displayOptions(args, guild, channel) {
  const dispCmd = args[0];
  const dispOption = args[1];
  log(`displayOptions | ${guild.id} | cmd: ${dispCmd} | option: ${dispOption}`);
  const binaryDisplayOptions = [
    "pin", "tzdisplay", "emptydays", "showpast", "help", "startonly"
  ];
  const embedStyleOptions = [
    "inline", "description", "url"
  ];
  if (binaryDisplayOptions.includes(dispCmd)) {
    displayOptionHelper(args, guild, channel);
  } else if (embedStyleOptions.includes(dispCmd)) {
    embedStyleHelper(args, guild, channel);
  } else if (dispCmd === "format") {
    if (dispOption) {
      const format = Number(dispOption);
      guild.setSetting("format", format);
      send(channel, (format === 12 ? "Set to 12-Hour clock format" : "Set to 24-Hour clock format"));
    } else { send(channel, "Please only use 12 or 24 for the clock display options");
    }
  } else if (dispCmd === "trim") {
    if (dispOption) {
      let size = Number(dispOption);
      guild.setSetting("trim", (isNaN(size) ? 0 : size)); // set to 0 if invalid, otherwise take number
      send(channel, `Set trimming of event titles to ${size} (0 = off)`);
    } else { send(channel, "Please provide a number to trim event titles. (0 = off)");
    }
  } else if (dispCmd === "desclength") {
    if (dispOption) {
      let size = Number(dispOption);
      guild.setSetting("descLength", (isNaN(size) ? 0 : size)); // set to 0 if invalid, otherwise take number
      send(channel, `Set trimming of description length to ${size} (0 = off)`);
    } else { send(channel, "Please provide a number to trim description length. (0 = off)");
    }
  } else if (dispCmd === "days") {
    if (dispOption) {
      const size = Number(dispOption);
      const days = 
        isNaN(size) ? 7 // if not a number - default to 7
          : size > 25 ? 25 // discord field limit is 25
            : size; // otherwise defualt to size
      guild.setSetting("days", days); // set to 0 if invalid, otherwise take number
      send(channel, `Changed days to display to: ${days} (you may have to use \`!displayoptions emptydays 0\`)`);
    } else { send(channel, "Please provide a number of days to display. (7 = default, 25 = max)");
    }
  } else if (dispCmd === "style") {
    if (dispOption === "code") {
      // revert dependent options
      guild.setSetting("inline", "0");
      guild.setSetting("description", "0");
    }
    if (dispOption) {
      guild.setSetting("style", dispOption);
      send(channel, `Changed display style to \`${dispOption}\``);
    } else { send(channel, "Please only use code or embed for the style choice. (see nilesbot.com/customisation)");
    }
  } else { send(channel, strings.DISPLAYOPTIONS_USAGE);
  }
}

/**
 * Delete specific event by ID
 * @param {String} eventID - ID of event to delete
 * @param {String} calendarID - ID of calendar to delete event form
 * @param {Snowflake} channel - callback channel
 */
function deleteEventById(eventID, calendarID, channel) {
  log(`deleteEventById | ${channel.guild.id} | eventID: ${eventID}`);
  const guild = new guilds.Guild(channel.guild.id);
  const params = {
    calendarId: calendarID,
    eventId: eventID,
    sendNotifications: true
  };
  const gCal = google.calendar({version: "v3", auth: guild.getAuth()});
  return gCal.events.delete(params).then(() => {
    getEvents(guild, channel);
    setTimeout(() => { updateCalendar(guild, channel, true); }, 2000);
  }).catch((err) => {
    helpers.log(`function deleteEventById error in guild: ${guild.id} : ${err}`);
  });
}

/**
 * List events within date range
 * @param {Guild} guild - Guild to pull from
 */
function listSingleEventsWithinDateRange(guild) {
  log(`listSingleEventsWithinDateRange | ${guild.id}`);
  const dayMap = guild.getDayMap();
  const calendarID = guild.getSetting("calendarID");
  const gCal = google.calendar({version: "v3", auth: guild.getAuth()});
  const params = {
    calendarId: calendarID,
    timeMin: dayMap[0].toISO(),
    timeMax: dayMap[6].toISO(),
    singleEvents: true,
    timeZone: guild.tz,
    orderBy: "startTime"
  };
  return gCal.events.list(params);
}

/**
 * Displays the next upcoming event in the calendar file
 * @param {Snowflake} channel - Channel to respond to
 * @returns {Snowflake} response with confirmation or failiure
 */
function nextEvent(guild, channel) {
  log(`nextEvent | ${guild.id}`);
  const now = DateTime.local().setZone(guild.tz);
  listSingleEventsWithinDateRange(guild).then((resp) => {
    if (!resp.data) return; // return if no data
    for (const eventObj of resp.data.items) {
      const isoDate = eventObj.start.dateTime || eventObj.start.date;
      const luxonDate = DateTime.fromISO(isoDate);
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
    log(`deleteEventById | ${guild.id} | no upcoming`);
    return send(channel, "No upcoming events within date range", 10000);
  }).catch((err) => { helpers.log(err);
  });
}

/**
 * Delete event on daymap with specific name
 * @param {[String]} args - command arguments
 * @param {Snowflake} channel - callback channel
 * @returns {Snowflake} command response
 */
function deleteEvent(args, guild, channel) {
  log(`deleteEvent | ${guild.id} | args: ${args}`);
  if (!args[0]) return send(channel, "You need to enter an argument for this command. i.e `!scrim xeno thursday 8pm - 9pm`");
  const text = args.join(" "); // join
  const calendarID = guild.getSetting("calendarID");
  listSingleEventsWithinDateRange(guild).then((resp) => {
    if (!resp.data) return; // return if no data
    for (const curEvent of resp.data.items) {
      if (curEvent.summary && text.toLowerCase().trim() === curEvent.summary.toLowerCase().trim()) {
        let promptDate = (curEvent.start.dateTime ? curEvent.start.dateTime : curEvent.start.date);
        send(channel, `Are you sure you want to delete the event **${curEvent.summary}** on ${promptDate}? **(y/n)**`, 30000);
        helpers.yesThenCollector(channel).then(() => { // collect yes
          deleteEventById(curEvent.id, calendarID, channel)
            .then(() => { return send(channel, `Event **${curEvent.summary}** deleted`);
            }).then((res) => { return res.delete({ timeout: 10000 });
            }).catch((err) => { helpers.log(err);
            });
        });
        return;
      }
    }
    send(channel, "Couldn't find event with that name - make sure you use exactly what the event is named!");
    log(`deleteEvent | ${guild.id} | no event within range`);
  }).catch((err) => {
    helpers.log(err);
    log(`deleteEvent | ${guild.id} | error ${err}`);
    return send(channel, "There was an error finding this event");
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
 * Checks for any issues with guild configuration
 * @param {Guild} guild - Guild to check agianst
 * @param {Snowflake} channel - Channel to respond to
 * @returns {bool} - if calendar fetches successfully
 */
function validate(guild, channel) {
  log(`validate | ${guild.id}`);
  const guildSettings = guild.getSetting();
  const gCal = google.calendar({version: "v3", auth: guild.getAuth()});
  const params = {
    calendarId: guildSettings.calendarID,
    timeMin: DateTime.local().toISO(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 1
  };
  let calTest = gCal.events.list(params).then((res) => {
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
  const missingPermissions = helpers.permissionCheck(channel);
  channel.send(`**Checks**:
    **Timezone:** ${passFail(helpers.validateTz(guildSettings.timezone))}
    **Calendar ID:** ${passFail(helpers.matchCalType(guildSettings.calendarID, channel))}
    **Calendar Test:** ${passFail(calTest)}
    **Missing Permissions:** ${missingPermissions ? missingPermissions : "🟢 None"}
    **Guild ID:** \`${guild.id}\`
    **Shard:** ${bot.client.shard.ids}
  `);
}

/**
 * Display current bot stats
 * @param {Snowflake} channel - Channel to reply to 
 */
function displayStats(channel) {
  log(`displayStats | ${channel.guild.id}`);
  bot.client.shard.fetchClientValues("guilds.cache.size").then((results) => {
    const { version } = require("../package.json");
    const usedMem = `${(process.memoryUsage().rss/1048576).toFixed()} MB`;
    const totalMem = (os.totalmem()>1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + " GB" : (os.totalmem() / 1048576).toFixed() + " MB");
    const embed = new bot.discord.MessageEmbed()
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
    return channel.send({ embed });
  }).catch((err) => {
    helpers.log(err);
  });
}

/**
 * Rename Calendar Name
 * @param {[String]} args - arguments passed in
 * @param {Guild} guild - Guild to pull settings from
 * @param {Snowflake} channel - Channel to respond to
 */
function calName(args, guild, channel) {
  let newCalName = args[0];
  log(`calName | ${guild.id}`);
  // no name passed in
  if (!newCalName) return send(channel, `You are currently using \`${guild.getSetting("calendarName")}\` as the calendar name. To change the name use \`${guild.prefix}calname <newname>\` or \`@Niles calname <newname>\``);
  // chain togeter args
  else newCalName = args.join(" "); // join
  if (newCalName.length > 256) { return send("Calendar title cannot be more than 256 characters"); }
  send(channel, `Do you want to set the calendar name to \`${newCalName}\` ? **(y/n)**`, 30000);
  helpers.yesThenCollector(channel).then(() => {
    guild.setSetting("calendarName", newCalName);
    log(`calName | ${guild.id} | changed to ${newCalName}`);
    return send(channel, `Changed calendar name to \`${newCalName}\``);
  }).catch((err) => { helpers.log(err);
  });
}

/**
 * Sets current channel to be Calendar channel
 * @param {[String]} args - arguments passed in 
 * @param {Guild} guild - Guild to set
 * @param {Snowflake} channel - Channel to respond to
 */
function setChannel(args, guild, channel) {
  log(`calName | ${guild.id}`);
  if (!args[0]) {
    const guildChannelId = guild.getSetting("channelid");
    if (guildChannelId) { // if existing channel
      const guildChannel = bot.client.channels.cache.get(guildChannelId);
      send(channel, `The current calendar channel is \`${guildChannel.name}\``);
    // if no channel set
    } else { send(channel, "There is no current calendar channel set"); }
    // no arguments
    send(channel, "Use `!channel set` or `!channel delete` to set or delete the current \"Calendar\" Channel");
  } else if (args[0] === "delete") { // remove channel
    log(`calName | ${guild.id} | delete`);
    guild.setSetting("channelid", "");
    send(channel, "Removed existing calendar channel");
  } else if (args[0] === "set") {
    log(`calName | ${guild.id} | set: ${channel.name}`);
    send(channel, `This will make the channel with name \`${channel.name}\` the primary channel for the calendar. All new calendars and updates will target this channel until \`!channel delete\` is run. Are you sure? (y/n)`, 30000);
    // set after collecting yes
    helpers.yesThenCollector(channel).then(() => { return guild.setSetting("channelid", channel.id);
    }).catch((err) => { helpers.log(err);
    });
  }
}

/**
 * set guild calendar id
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - command arguments
 * @param {Guild} guild - Guild to change ID for
 */
function logID(channel, args, guild) {
  log(`logID | ${guild.id}`);
  const newCalendarID = args[0];
  const oldCalendarID = guild.getSetting("calendarID");
  if (!newCalendarID) {
    // no input, display current id
    if (oldCalendarID) channel.send(`You didn't enter a calendar ID, you are currently using \`${oldCalendarID}\``);
    // no input
    else channel.send("Enter a calendar ID using `!id`, i.e. `!id 123abc@123abc.com`");
  }
  // did not pass validation
  else if (!helpers.matchCalType(newCalendarID, channel)) {
    log(`logID | ${guild.id} | failed calType`);
    channel.send("I don't think that's a valid calendar ID... try again");
  // overwrite calendarid, passed validation
  } else if (oldCalendarID) {
    channel.send(`I've already been setup to use \`${oldCalendarID}\` as the calendar ID in this server, do you want to overwrite this and set the ID to \`${newCalendarID}\`? **(y/n)**"`);
    helpers.yesThenCollector(channel).then(() => {
      log(`logID | ${guild.id} | set to newID: ${newCalendarID}`);
      return guild.setSetting("calendarID", newCalendarID);
    }).catch((err) => { helpers.log(err);
    });
  // no set calendarid, passed validation
  } else {
    log(`logID | ${guild.id} | set to newID: ${newCalendarID}`);
    guild.setSetting("calendarID", newCalendarID);
  }
}

/**
 * set guild tz
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - arguments passed in 
 * @param {Guild} guild - Guild getter to change settings for
 */
function logTz(channel, args, guild) {
  log(`logTz | ${guild.id}`);
  const currentTz = guild.getSetting("timezone");
  const tz = args[0];
  if (!tz) { // no input
    // no current tz
    if (!currentTz) channel.send("Enter a timezone using `!tz`, i.e. `!tz America/New_York` or `!tz UTC+4` or `!tz EST` No spaces in formatting.");
    // timezone define
    else channel.send(`You didn't enter a timezone, you are currently using \`${currentTz}\``);
  }
  // valid input
  else if (helpers.validateTz(tz)) { // passes validation
    if (currentTz) { // timezone set
      channel.send(`I've already been setup to use \`${currentTz}\`, do you want to overwrite this and use \`${tz}\`? **(y/n)**`);
      helpers.yesThenCollector(channel).then(() => {
        log(`logID | ${guild.id} | set to newID: ${tz}`);
        return guild.setSetting("timezone", tz);
      }).catch((err) => { helpers.log(err);
      });
    // timezone is not set
    } else {
      log(`logID | ${guild.id} | set to newID: ${tz}`);
      guild.setSetting("timezone", tz); }
  // fails validation
  } else {
    log(`logID | ${guild.id} | failed validation: ${tz}`);
    channel.send("Enter a timezone in valid format `!tz`, i.e. `!tz America/New_York` or `!tz UTC+4` or `!tz EST` No spaces in formatting."); }
}

/**
 * Sets guild prefix
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - arguments passed in
 * @param {Guild} guild - Guild to change prefix for
 */
function setPrefix(channel, args, guild) {
  log(`setPrefix | ${guild.id}`);
  const newPrefix = args[0];
  if (!newPrefix) { send(channel, `You are currently using \`${guild.prefix}\` as the prefix. To change the prefix use \`${guild.prefix}prefix <newprefix>\` or \`@Niles prefix <newprefix>\``);
  } else if (newPrefix) {
    channel.send(`Do you want to set the prefix to \`${newPrefix}\` ? **(y/n)**`);
    helpers.yesThenCollector(channel).then(() => {
      send(channel, `prefix set to ${newPrefix}`);
      log(`setPrefix | ${guild.id} | set to: ${newPrefix}`);
      return guild.setSetting("prefix", newPrefix);
    }).catch((err) => { helpers.log(err); });
  }
}

/**
 * Set admin role
 * @param {Snowflake} message - initating message
 * @param {[String]} args - arguments from command
 * @param {Guild} guild - guild to pull settings from
 */
function setRoles(message, args, guild) {
  log(`setRoles | ${guild.id}`);
  const adminRole = args[0];
  const allowedRoles = guild.getSetting("allowedRoles");
  const userRoles = message.member.roles.cache.map((role) => role.name);
  let roleArray;
  if (!adminRole) {
    // no argument defined
    if (allowedRoles.length === 0) return message.channel.send(strings.RESTRICT_ROLE_MESSAGE);
    // admin role exists
    message.channel.send(`The admin role for this discord is \`${allowedRoles}\`. You can change this setting using \`${guild.prefix}admin <ROLE>\`, making sure to spell the role as you've created it. You must have this role to set it as the admin role.\n You can allow everyone to use Niles again by entering \`${guild.prefix}admin everyone\``);
  } else if (adminRole) {
    // add everyone
    if (adminRole.toLowerCase() === "everyone") {
      log(`setRoles | ${guild.id} | prompt everyone`);
      message.channel.send("Do you want to allow everyone in this channel/server to use Niles? **(y/n)**");
      roleArray = [];
    // no role selected
    } else if (!userRoles.includes(adminRole)) {
      log(`setRoles | ${guild.id} | do not have role`);
      message.channel.send("You do not have the role you're trying to assign. Remember that adding Roles is case-sensitive");
    } else {
      // restricting succeeded
      log(`setRoles | ${guild.id} | prompt role: ${adminRole}`);
      message.channel.send(`Do you want to restrict the use of the calendar to people with the \`${adminRole}\`? **(y/n)**`);
      roleArray = [adminRole];
    }
    // prompt for confirmation
    helpers.yesThenCollector(message.channel).then(() => { return guild.setSetting("allowedRoles", roleArray);
    }).catch((err) => { helpers.log(err); });
  }
}

/**
 * Admin-only commands
 * @param {String} cmd - command to run
 * @param {[String]} args - args of command
 * @returns {String} - response of command
 */
function adminCmd (cmd, args) {
  log(`adminCmd | cmd ${cmd} | args: ${args}`);
  if (cmd === "timers") {
    return (`There are ${Object.keys(timerCount).length} timers running on shard ${bot.client.shard.ids}.`);
  } else if (cmd === "reset") {
    let response = "";
    const shardNo = Number(args[0]); // check for valid shard
    if (isNaN(shardNo)) { response = "Invalid shard number"; // check for valid number
    } else {
      response = `Restarting shard ${shardNo}`;
      helpers.log(response);
      bot.client.shard.broadcastEval(`if (this.shard.ids.includes(${shardNo})) process.exit();`);
    }
    return response;
  }
}

/**
 * Run Commands
 * @param {Snowflake} message 
 */
function run(cmd, args, message) {
  const guildID = message.guild.id;
  const guild = new guilds.Guild(guildID);
  const guildSettings = guild.getSetting();
  const channel = message.channel;
  const guildChannel = (guildSettings.channelid ? bot.client.channels.cache.get(guildSettings.channelid) : channel);
  const sentByAdmin = (settings.secrets.admins.includes(message.author.id)); // check if author is admin
  log(`run | ${guildID} | cmd: ${cmd} | args: ${args}`);
  // start commands
  if (["ping"].includes(cmd)) { channel.send(`:ping_pong: !Pong! ${(bot.client.ws.ping).toFixed(0)}ms`);
  } else if (["init"].includes(cmd)) {
    log(`init | ${guildID}`);
    channel.send("Resetting Niles to default");
    guilds.recreateGuild(guildID);
  } else if (["invite"].includes(cmd)) {
    const inviteEmbed = {
      description: `Click [here](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${bot.client.user.id}) to invite me to your server`,
      color: 0xFFFFF };
    channel.send({ embed: inviteEmbed });
  } else if (["admin"].includes(cmd)) { setRoles(message, args, guild);
  } else if (["prefix"].includes(cmd)) { setPrefix(channel, args, guild);
  } else if (["id"].includes(cmd)) { logID(channel, args, guild);
  } else if (["tz"].includes(cmd)) { logTz(channel, args, guild);
  // end setup mode commands
  } else if (!guildSettings.calendarID || !guildSettings.timezone) { 
    log(`setup-mode | ${guildID} | cmd: ${cmd} | args: ${args}`);
    // send setup-specific help message
    if (["help"].includes(cmd)) { channel.send(strings.SETUP_HELP); }
    else if (["setup", "start"].includes(cmd)) { channel.send(strings.SETUP_MESSAGE); }
    else { channel.send("You haven't finished setting up! Try `!setup` for details on how to start."); }
  // if in setup mode, hard stop & force exit
  } else if (["help"].includes(cmd)) { channel.send(strings.HELP_MESSAGE);
  } else if (["clean", "purge"].includes(cmd)) { deleteMessages(args, channel);
  } else if (["display"].includes(cmd)) {
    log(`display | ${guildID}`);
    setTimeout(() => { getEvents(guild, guildChannel); }, 1000);
    setTimeout(() => { postCalendar(guild, guildChannel); }, 2000);
  } else if (["update", "sync"].includes(cmd)) { calendarUpdater(guild, guildChannel, true);
  } else if (["create", "scrim"].includes(cmd)) {
    log(`create | ${guildID}`);
    quickAddEvent(args, guild, channel);
    calendarUpdater(guild, guildChannel, true);
  } else if (["displayoptions"].includes(cmd)) { displayOptions(args, guild, channel);
  } else if (["stats", "info"].includes(cmd)) { displayStats(channel);
  } else if (["get"].includes(cmd)) { getEvents(guild, channel);
  } else if (["stop"].includes(cmd)) { killUpdateTimer(guild.id);
  } else if (["delete"].includes(cmd)) { deleteEvent(args, guild, channel);
  } else if (["next"].includes(cmd)) { nextEvent(guild, channel);
  } else if (["count"].includes(cmd)) {
    const theCount = (!timerCount[guildID] ? 0 : timerCount[guildID]);
    channel.send(`There are ${theCount} timer threads running in this guild`);
  } else if (["timers", "reset"].includes(cmd)) { channel.send (sentByAdmin ? adminCmd(cmd, args) : "Not Admin");
  } else if (["validate"].includes(cmd)) { validate(guild, channel);
  } else if (["calname"].includes(cmd)) { calName(args, guild, channel);
  } else if (["auth"].includes(cmd)) { setupAuth(args, guild, channel);
  } else if (["channel"].includes(cmd)) { setChannel(args, guild, channel);
  }
  message.delete({ timeout: 5000 });
}

module.exports = {
  run,
  killUpdateTimer
};
