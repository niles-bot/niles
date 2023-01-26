const columnify = require("columnify");
const { totalmem } = require("os");
const discord = require("discord.js");
const { DateTime, Duration } = require("luxon");
const log = require("debug")("niles:cmd");
const { i18n } = require("./strings.js");
const { client } = require("../bot.js");
const settings = require("../settings.js");
const helpers = require("./helpers.js");
const guilds = require("./guilds.js");
const updaterList = require("./updaterList.js");
const denyList = require("./denylist.js");
const discordLog = helpers.log;
const eventType = helpers.eventType;
const { doHandler } = require("./displayoptions.js");
const gCalendar = require("@googleapis/calendar").calendar;
const soft = require("timezone-soft");
const { zoneNames } = require("@mchangrh/tzdb-names");

//functions
/**
 * Send message with deletion timeout
 * @param {Snowflake} channel - channel to send message in
 * @param {String} content - content of message
 * @param {Number} [timeout=5000] - time in milliseconds before message is deleted
 */
function send(channel, content, timeout=5000) {
  channel.send(content)
    .then((message) => setTimeout(() => message.delete(), timeout));
}

/**
 * Get and store access token after promptiong for user authorization
 * @param {bool} force - force reauthentication
 * @param {Guild} guild - Guild to pull settings from
 * @param {Snowflake} channel - channel to respond and listen to
 */
function getAccessToken(force, guild, channel) {
  log(`getAccessToken | ${guild.id}`);
  if (!settings.oauth2) { return send(channel, i18n.t("auth.oauth.notinstalled", { lng: guild.lng })); }
  const authUrl = settings.oauth2.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.events"]
  });
  if (guild.getSetting("auth") === "oauth" && !force) {
    log("getAccessToken | no reauth");
    return send(channel, i18n.t("auth.oauth.reauth", { lng: guild.lng }));
  }
  const authEmbed = {
    color: 0x0099e1,
    description: i18n.t("auth.oauth.prompt", { lng: guild.length, authUrl })
  };
  log("getAccessToken | send auth embed");
  send(channel, { embeds: [authEmbed] }, 30000 );
  let collector = channel.createMessageCollector((msg) => !msg.author.bot, { time: 30000 });
  collector.on("collect", (m) => {
    settings.oauth2.getToken(m.content, (err, token) => {
      if (err) return send(channel, i18n.t("auth.oauth.err", { lng: guild.lng, err }));
      send(channel, i18n.t("auth.oauth.confirm", { lng: guild.lng }));
      guild.setSetting("auth", "oauth");
      guild.setToken(token);
    });
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") send(channel, i18n.t("collector.timeout", { lng: guild.lng }));
  });
}

/**
 * Force Set Access Token
 * @param {string} guild guildID of target
 * @param {Channel} channel channel of target
 * @param {*} input 
 * @returns 
 */
function setAccessToken(guild, channel, input) {
  if (!settings.oauth2) { return send(channel, i18n.t("auth.oauth.notinstalled", { lng: guild.lng })); }
  settings.oauth2.getToken(input, (err, token) => {
    if (err) return send(channel, i18n.t("auth.oauth.err", { lng: guild.lng, err }));
    send(channel, i18n.t("auth.oauth.confirm", { lng: guild.lng }));
    guild.setSetting("auth", "oauth");
    guild.setToken(token);
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
    if (!settings.oauth2) return send(channel, i18n.t("auth.oauth.notinstalled", { lng: guild.lng }));
    if (args[1] === "set") {
      return setAccessToken(guild, channel, args[2]);
    }
    getAccessToken((args[1] === "force"), guild, channel);
  } else if (args[0] === "sa") {
    if (!settings.sa) return send(channel, i18n.t("auth.sa.notinstalled", { lng: guild.lng }));
    guild.getSetting("auth", "sa");
    send(channel, i18n.t("auth.sa.invite", { lng: guild.lng, saId: settings.saId }), 10000);
  } else { send(channel, i18n.t("auth.noarg", { lng: guild.lng }), 10000);
  }
}

/**
 * Safely deletes update timer
 * @param {String} guildID - guild to remove from timers
 * @param {String} reason - reason for removal
 */
function killUpdateTimer (guildID, reason = "none") {
  // null out last err
  const guild = new guilds.Guild(guildID);
  guild.setLastErr(reason);
  // remove from updaterlist
  updaterList.remove(guildID);
  const message = `removed ${guildID} | ${reason}`;
  discordLog(message);
  console.error(message);
}

/**
 * Recreate calendar instead of killing
 * @param {String} guildID 
 * @param {String} reason 
 */
function recreateCalendar (guildID, channel, reason = "none") {
  const message = `recreated ${guildID} | ${reason}`;
  const guild = new guilds.Guild(guildID);
  const lastUpdate = guild.getCalendar("lastUpdate");
  if ((Date.now() - Date.parse(lastUpdate)) < 1000 * 60 * 2) {
    const earlyEndMsg = `refusing to recreate within two minutes ${guildID} | ${reason}`;
    console.error(earlyEndMsg);
    discordLog(earlyEndMsg);
    return;
  }
  discordLog(message);
  console.error(message);
  // create calendar
  getEvents(guild, channel);
  postCalendar(guild, channel);
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
    killUpdateTimer(guild.id, "clean");
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
 * @param {String} lng - Locale of guild
 */
function deleteMessages(args, channel, lng) {
  const argMessages = Number(args[0]);
  const deleteCalendar = Boolean(args[1]);
  if (!argMessages || isNaN(argMessages)) {
    return channel.send(i18n.t("delete.noarg", { lng }));
  } else {
    channel.send("[WARNING] Collector does not wait anymore, it will start deleting immediately");
    setTimeout(1000);
    clean(channel, argMessages, deleteCalendar)
      .catch((err) => discordLog(err));
  }
}

/**
 * Parses and corrects events for classification
 * @param {Date} day - Day to classify events agians
 * @param {Event} event - event to classify
 * @param {IANAZone} tz - timezone to align dates to 
 * @returns 
 */
function eventTimeCorrector(day, event, tz) {
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
    // do not remove a day, since it is mitigated in classifyEventMatch
    eEndDate = DateTime.fromISO(event.end.date, {zone: tz});
  }
  // log(`Event to CEM: ${event.summary}`);
  return helpers.classifyEventMatch(day, eStartDate, eEndDate);
}

/**
 * handles errors from getEvents
 * @param {Error} err - Error with information
 * @param {Guild} guild - Guild to get language and ID from
 * @param {Snowflake} channel - Channel to respond to
 */
function getEventsErrorHandler(err, guild, channel) {
  log(`getEvents | ${guild.id} | ${err}`);
  if (err.code === 404) {
    discordLog(`getEvents error in guild: ${guild.id} : 404 error can't find calendar`);
    channel.send(i18n.t("no_cal", { lng: guild.lng }));
  } else if (err.code === 401) { discordLog(`getEvents error in guild: ${guild.id} : 401 invalid credentials`);
  } else { discordLog(`getEvents error in guild: ${guild.id} : ${err}`);
  }
  channel.send(i18n.t("timerkilled", { lng: guild.lng }));
  //recreateCalendar(guild.id, channel, "getEvents");
  killUpdateTimer(guild.id, "getEvents");
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
  let events = {};
  // construct calendar with old calendar file
  const params = {
    calendarId: guild.getSetting("calendarID"),
    timeMin: dayMap[0].toISO(),
    timeMax: dayMap[dayMap.length-1].endOf("day").toISO(), // get all events of last day!
    singleEvents: true,
    orderBy: "startTime",
    timeZone: tz
  };
  const gCal = gCalendar({version: "v3", auth});
  try {
    gCal.events.list(params).then((res) => {
      log(`getEvents - list | ${guild.id}`);
      for (let day = 0; day < dayMap.length; day++) {
        let key = "day" + String(day);
        let matches = [];
        res.data.items.map((event) => {
          let eType = eventTimeCorrector(dayMap[day], event, tz);
          if (eType !== eventType.NOMATCH) {
            matches.push({
              id: event.id,
              summary: event.summary,
              start: event.start,
              end: event.end,
              description: helpers.descriptionParser(event.description),
              location: event.location || event.hangoutLink,
              type: eType
            });
          }
          events[key] = matches;
        });
      }
      guild.setEvents(events);
    }).catch((err) => {
      getEventsErrorHandler(err, guild, channel);
    });
  } catch (err) {
    channel.send(err.code);
    return discordLog(`Error in function getEvents in guild: ${guild.id} : ${err}`);
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
  const guildCalendar = guild.getCalendar("events");
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
  const titleName = (event.summary) ? helpers.trimEventName(event.summary, guildSettings.trim) : " ";
  const urlPattern = new RegExp("^https?://");
  // if location is url & setting is on
  const addURL = (urlPattern.test(event.location) && guildSettings.url === "1");
  log(`eventNameCreator | url: ${addURL}`);
  return (addURL ? `[${titleName}](${event.location})` : titleName);
}

/**
 * Creates duration string
 * @param {Event} event - Event to create for
 * @param {Guild} guild - guild to pull settings from
 * @returns {String}
 */
function durationString(event, guild) {
  // check for early exit condition
  // middle of multi-day or no time, must be "All Day"
  if (Object.keys(event.start).includes("date") || event.type === eventType.MULTIMID) return "All Day";
  // event must have dateTime
  const guildSettings = guild.getSetting();
  let tempStartDate = ((guildSettings.format === 24) ? "....." : "........");
  let tempFinDate = ((guildSettings.format === 24) ? "....." : "........");
  if (event.type === eventType.SINGLE || event.type === eventType.MULTISTART) {
    tempStartDate = helpers.getStringTime(event.start.dateTime, guild);
  }
  if (event.type === eventType.SINGLE || event.type === eventType.MULTYEND) {
    tempFinDate = helpers.getStringTime(event.end.dateTime, guild);
  }
  return (guildSettings.startonly === "1" ? tempStartDate : tempStartDate + " - " + tempFinDate); // optionally only show start time
}

/**
 * Creates event discord timestamp
 * @param {Event} event - Event to create for
 * @returns {String}
 */
function generateEventTimeStamp(event) {
  // check for early exit condition
  // middle of multi-day or no time, return empty string
  if (Object.keys(event.start).includes("date") || event.type === eventType.MULTIMID) return "";
  // event must have dateTime
  const zDate = DateTime.fromISO(event.start.dateTime, {setZone: true});
  const timestamp = zDate.toSeconds();
  return `<t:${timestamp}:R>`;
}

/**
 * Generate codeblock messsage for calendar display
 * @param {Guild} guild - guild to create for
 */
function generateCalendarCodeblock(guild) {
  log(`generateCalendarCodeblock | ${guild.id}`);
  const guildCalendar = guild.getCalendar("events");
  const guildSettings = guild.getSetting();
  const dayMap = guild.getDayMap();
  let finalString = "";
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let sendString = "";
    sendString += "\n**" + dayMap[i].toLocaleString({ weekday: "long" }, { locale: guild.lng }) + "** - "+ dayMap[i].toLocaleString({ month: "long", day: "2-digit" }, { locale: guild.lng });
    if (guildSettings.emptydays === "0" && guildCalendar[key].length === 0) continue;
    if (guildCalendar[key].length === 0) {
      sendString += "```\n ```";
    } else {
      sendString += "```\n";
      // Map events for each day
      guildCalendar[key].map((event) => {
        const options = {
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
        const eventTitle = (event.summary) ? helpers.trimEventName(event.summary, guildSettings.trim) : " ";
        const duration = durationString(event, guild);
        const tempString = {[duration]: eventTitle};
        const lineString = (guildSettings.seperateheader === "1" ? duration + "\n" + eventTitle : columnify(tempString, options));
        sendString += (guildSettings.eventtime === "1" ? lineString + "\n" : eventTitle + "\n");
      });
      sendString += "```";
    }
    finalString += sendString;
  }
  // log(`generateCalendarCodeblock | ${guild.id}| finalString ${finalString}`);
  return finalString; // return finalstring to generateCalendar
}

/**
 * Create event strings for emebeds
 * @param {Event} event - Event to create strings for
 * @param {Guild} guild - guild with settings to pull from
 * @Returns {String} - constructed event string
 */
function embedEventString(event, guild) {
  const guildSettings = guild.getSetting();
  const duration = durationString(event, guild);
  const eventTitle = eventNameCreator(event, guildSettings); // add link if there is a location
  const eventTimeStamp = (guildSettings.timestamp === "1" ? generateEventTimeStamp(event): '');
  let eventString = (guildSettings.eventtime === "1" ? `**${duration}** | ${eventTitle} ${eventTimeStamp}\n`: `${eventTitle}\n`);
  // limit description length
  const descLength = guildSettings.descLength;
  const description = event.description;
  const trimmed = (descLength ? description.slice(0, descLength) : description);
  // if we should add description
  if ((description !== "undefined") && (guildSettings.description === "1")) {
    eventString += `\`${trimmed}\`\n`;
  }
  return eventString;
}

/**
 * Generate embed for calendar display
 * @param {Guild} guild - guild to create for
 */
function generateCalendarEmbed(guild) {
  log(`generateCalendarEmbed | ${guild.id}`);
  let guildCalendar = guild.getCalendar("events");
  let guildSettings = guild.getSetting();
  const dayMap = guild.getDayMap();
  let msgLength = 0;
  let fields = [];
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let tempValue = "";
    let fieldObj = {
      name: "**" + dayMap[i].toLocaleString({ weekday: "long" }, { locale: guild.lng }) + "** - " + dayMap[i].toLocaleString({ month: "long", day: "2-digit" }, { locale: guild.lng }),
      inline: (guildSettings.inline === "1")
    };
    if (guildSettings.emptydays === "0" && guildCalendar[key].length === 0) continue;
    if (guildCalendar[key].length === 0) tempValue = "\u200b";
    else {
      // Map events for each day
      guildCalendar[key].forEach((event) => {
        tempValue += embedEventString(event, guild);
      });
    }
    // finalize field object
    // log(`generateCalendarEmbed | ${guild.id} | value ${tempValue}`);
    fieldObj.value = tempValue;
    // add to msgLength
    msgLength += tempValue.length;
    // if length over 1024, replace with error.
    if (tempValue.length >= 1024) {
      fieldObj.value = i18n.t("calendar.too_long_day", { lng: guild.lng});
    }
    fields.push(fieldObj);
  }
  // check if too many characters
  // 200 character buffer - 
  if (msgLength + 200 > 6000) {
    fields = [{
      "name": i18n.t("calendar.too_long", { lng: guild.lng}),
      "value": i18n.t("calendar.too_long_help", { lng: guild.lng, msgLength })
    }];
  } else if (fields.length > 25) {
    fields = [{
      "name": i18n.t("calendar.too_many", { lng: guild.lng}),
      "value": i18n.t("calendar.too_many_help", { lng: guild.lng, days: fields.length })
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
  // announcement channels are not supported https://git.io/JsGcy
  if (channel.type === "news") {
    channel.send(i18n.t("announcement", { lng: guild.lng }));
    return killUpdateTimer(guild.id, "news channel");
  }
  // create embed
  let embed = new discord.MessageEmbed();
  embed.setTitle(guildSettings.calendarName)
    .setColor("BLUE")
    .setFooter({ text: "Last update" })
    .setTimestamp();
  if (guildSettings.calurl === "1") {
    embed.setURL("https://calendar.google.com/calendar/embed?src=" + guildSettings.calendarID);
  }
  // set description or fields
  if (isEmptyCalendar(guild, dayMap)) {
    embed.setDescription("```No Upcoming Events```");
  } else if (guildSettings.style === "code") {
    embed.setDescription(generateCalendarCodeblock(guild));
    //Handle Calendars Greater Than 2048 Characters Long
    if (embed.length>2048) {
      channel.send(i18n.t("calendar.too_long", { lng: guild.lng }));
      return 2048;
    }
  } else if (guildSettings.style === "embed") {
    embed.fields = generateCalendarEmbed(guild);
  }
  // add other embeds after code
  if (guildSettings.helpmenu === "1") {
    embed.addField(i18n.t("calendar.embed.help_title", { lng: guild.lng }), i18n.t("calendar.embed.help_desc", { lng: guild.lng }), false);
  }
  if (guildSettings.tzDisplay === "1") { // display timezone
    embed.addField("Timezone", guildSettings.timezone, false);
  }
  return embed;
}

/**
 * Start update timer for guild mentioned
 * @param {String} guildID - ID of guild to update
 * @param {String} channelid - ID of channel to callback to
 */
function startUpdateTimer(guildID, channelid) {
  if (updaterList.exists(guildID)) {
    log(`startUpdateTimer | ${guildID} | updater exists exists`);
    return discordLog(`timer already exists in guild: ${guildID}`);
  } else {
    log(`startUpdateTimer | ${guildID} | no current updater`);
    discordLog(`Starting update timer in guild: ${guildID}`);
    updaterList.append(guildID, channelid);
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
  if (!guildCalendarMessageID) {
    channel.send(i18n.t("update.undefined", { lng: guild.lng }));
    discordLog(`calendar undefined in ${guild.id}. Killing update timer.`);
    //return recreateCalendar(guild.id, channel, "calendar undefined");
    return killUpdateTimer (guild.id, "calendar undefined");
  }
  const embed = generateCalendar(guild, channel);
  if (embed === 2048) return null;
  channel.messages.fetch(guildCalendarMessageID)
    .then((m) => m.edit({ embeds: [embed] }))
    .catch((err) => {
      log(`updateCalendar | ${err}`);
      discordLog(`error fetching previous calendar message in guild: ${guild.id} : ${err}`);
      console.log(guild.getLastErr());
      if (guild.getLastErr() !== err.code && err.code == 10008) {
        // if last err was not also unknown message error, just skip this cycle
        guild.setLastErr(err.code);
        discordLog(`skipping update cycle in guild: ${guild.id}`);
        return;
      }
      // If theres an updater running try and kill it.
      channel.send(i18n.t("timerkilled", { lng: guild.lng }));
      channel.send(i18n.t("update.not_found", { lng: guild.lng }));
      killUpdateTimer(guild.id, "error fetching previous");
      return guild.setCalendarID("");
    });
  // if everything went well, set lastUpdate
  guild.setCalendarLastUpdate(new Date());
  // if no errors thrown and not on updaterlist, start timer
  if (!updaterList.exists(guild.id) && human) startUpdateTimer(guild.id, channel.id);
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
    getEvents(guild, channel);
    updateCalendar(guild, channel, human);
  } catch (err) {
    discordLog(`error in autoupdater in guild: ${guild.id} : ${err}`);
    killUpdateTimer(guild.id, channel, "error in updater");
  }
}

/**
 * starts workerUpdate from sidecar
 * @param {String} guildid
 * @param {Snowflake} channel
 */
function workerUpdate(guildid, channel) {
  const guild = new guilds.Guild(guildid);
  log(`workerUpdate | ${guild.id} | ${channel.id}`);
  calendarUpdater(guild, channel, false);
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
    channel.messages.fetch(guildCalendarMessageID)
      .then((message) => setTimeout(() => message.delete(), 10000))
      .catch((err) => discordLog(`error fetching previous calendar in guild: ${guild.id} : ${err}`));
  }
  try {
    const embed = generateCalendar(guild, channel);
    if (embed === 2048) return null;
    channel.send({ embeds: [embed] }).then((sent) => {
      log(`postCalendar | ${guild.id} | calID ${sent.id}`);
      guild.setCalendarID(sent.id);
      if (guild.getSetting("pin") === "1") sent.pin();
    });
    startUpdateTimer(guild.id, channel.id);
  } catch (err) {
    if (err===2048) discordLog(`function postCalendar error in guild: ${guild.id} : ${err} - Calendar too long`);
    else discordLog(`function postCalendar error in guild: ${guild.id} : ${err}`);
  }
}

/**
 * Adds an event to google calendar via quickAddEvent
 * @param {[String]} args - Arguments passed in 
 * @param {Guild} guild - Guild to work agianst
 * @param {Snowflake} channel - Channel to callback to
 */
function quickAddEvent(args, guild, channel) {
  log(`quickAddEvent | ${guild.id} | args ${args}`);
  if (!args[0]) return send(channel, i18n.t("quick_add.noarg", { lng: guild.lng }));
  const zwsp = "​";
  let text = args.join(" "); //join
  if (["["].includes(text[0]))
    text = zwsp + text; // add zswp if starts with """invalid""" characters
  const params = {
    calendarId: guild.getSetting("calendarID"),
    text: args.join(" ") // join
  };
  const gCal = gCalendar({version: "v3", auth: guild.getAuth()});
  gCal.events.quickAdd(params).then((res) => {
    const promptDate = (res.data.start.dateTime ? res.data.start.dateTime : res.data.start.date);
    return send(channel, i18n.t("quick_add.confirm", { lng: guild.lng, summary: res.data.summary, promptDate }));
  }).catch((err) => { discordLog(`function quickAddEvent error in guild: ${guild.id} : ${err}`);
  });
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
  const gCal = gCalendar({version: "v3", auth: guild.getAuth()});
  return gCal.events.delete(params).then(() => {
    getEvents(guild, channel);
    updateCalendar(guild, channel, true);
  }).catch((err) => {
    discordLog(`function deleteEventById error in guild: ${guild.id} : ${err}`);
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
  const gCal = gCalendar({version: "v3", auth: guild.getAuth()});
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
 * Converts duration to human-readable string
 * @param {Object} duration - duration to convert
 * @returns {String} - String represenation of duration
 */
function durationToString(duration) {
  let timeToString = "";
  if (duration.days) timeToString += `${duration.days} days `;
  if (duration.hours) timeToString += `${duration.hours} hours `;
  if (duration.minutes) timeToString += `${duration.minutes} minutes`;
  return timeToString;
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
        const timeToString = durationToString(timeTo);
        return channel.send(i18n.t("next.next", { summary: eventObj.summary, timeToString, lng: guild.lng }));
      }
    }
    // run if message not sent
    log(`nextEvent | ${guild.id} | no upcoming`);
    return send(channel, i18n.t("next.no_upcoming", {lng: guild.lng }), 10000);
  }).catch((err) => { discordLog(err);
  });
}

/**
 * Search and return for event with given name
 * @param {String} summary - summary of event to search for 
 * @param {Guild} guild - Guild with calendar settings
 * @param {Snowflake} channel - channel to send errors to
 * @returns {Event} - event matching summary if exists
 */
function searchEventName(summary, guild, channel) {
  // console log
  console.log(`delete |${summary}|`);
  listSingleEventsWithinDateRange(guild)
    .then((resp) => {
      console.log(typeof(resp.data));
      if (!resp.data) return;
      for (let curEvent of resp.data.items) {
        console.log(`Summary |${curEvent.summary}|`);
        if (curEvent.summary && summary.toLowerCase().trim() === curEvent.summary.toLowerCase().trim()) {
          return curEvent;
        }
      }
    }).catch((err) => {
      log(`searchEventName | ${guild.id} | error ${err}`);
      discordLog(err);
      send(channel, i18n.t("deleteevent.error", {lng: guild.lng }));
    });
  //return false;
}

/**
 * Delete event on daymap with specific name
 * @param {[String]} args - command arguments
 * @param {Snowflake} channel - callback channel
 * @returns {Snowflake} command response
 */
function deleteEvent(args, guild, channel) {
  log(`deleteEvent | ${guild.id} | args: ${args}`);
  if (!args[0]) return send(channel, i18n.t("deleteevent.noarg", {lng: guild.lng }));
  const event = searchEventName(args.join(" "), guild, channel); // search for event
  console.log(event);
  if (!event) {
    send(channel, i18n.t("deleteevent.not_found", {lng: guild.lng }));
    return log(`deleteEvent | ${guild.id} | no event within range`);
  }
  let promptDate = (event.start.dateTime ? event.start.dateTime : event.start.date);
  send(channel, i18n.t("deleteevent.prompt", {lng: guild.lng, summary: event.summary, promptDate}), 30000);
  const calendarID = guild.getSetting("calendarID");
  helpers.yesThenCollector(channel, guild.lng)
    .then(() => { // collect yes
      deleteEventById(event.id, calendarID, channel);
    })
    .then(() => send(channel, i18n.t("deleteevent.confirm", {lng: guild.lng, summary: event.summary })))
    .then((message) => setTimeout(() => message.delete(), 10000))
    .catch((err) => discordLog(err));
}

/**
 * Get next event for validation
 * @param {Guild} guild - Guild to pull calendar ID from
 * @param {Snowflake} channel - callback for error messages
 */
function validateNextEvent(guild, channel) {
  const gCal = gCalendar({version: "v3", auth: guild.getAuth()});
  const params = {
    calendarId: guild.getSetting("calendarID"),
    timeMin: DateTime.local().toISO(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 1
  };
  gCal.events.list(params).then((res) => {
    const event = res.data.items[0];
    channel.send(`**Next Event:**
      **Summary:** \`${event.summary}\`
      **Start:** \`${event.start.dateTime || event.start.date }\`
      **Calendar ID:** \`${event.organizer.email}\`
    `);
  }).catch((err) => { 
    channel.send(i18n.t("validate.calendar_error", {lng: guild.lng, err}));
  });
}

/**
 * Returns pass or fail instead of boolean
 * @param {boolean} bool
 * @returns {String}
 */
const passFail = (bool) => (bool ? "Passed 🟢" : "Failed 🔴");

/**
 * Checks for any issues with guild configuration
 * @param {Guild} guild - Guild to check agianst
 * @param {Snowflake} channel - Channel to respond to
 * @returns {bool} - if calendar fetches successfully
 */
function validate(guild, channel) {
  log(`validate | ${guild.id}`);
  const guildSettings = guild.getSetting();
  const missingPermissions = helpers.permissionCheck(channel);
  validateNextEvent(guild, channel); // print calendar test results
  channel.send(`**Checks**:
    **Timezone:** ${passFail(helpers.validateTz(guildSettings.timezone))}
    **Calendar ID:** ${passFail(helpers.matchCalType(guildSettings.calendarID, channel, guild))}
    **Missing Permissions:** ${missingPermissions ? missingPermissions : "🟢 None"}
    **On Updater List:** ${passFail(updaterList.exists(guild.id))}
    **Guild ID:** \`${guild.id}\`
    **Shard:** ${client.shard.ids}
  `);
}

/**
 * Display current bot stats
 * @param {Snowflake} channel - Channel to reply to 
 */
function displayStats(channel) {
  log(`displayStats | ${channel.guild.id}`);
  client.shard.fetchClientValues("guilds.cache.size").then((results) => {
    const { version } = require("../package.json");
    const usedMem = `${(process.memoryUsage().rss/1048576).toFixed()} MB`;
    const totalMem = (totalmem()>1073741824 ? (totalmem() / 1073741824).toFixed(1) + " GB" : (totalmem() / 1048576).toFixed() + " MB");
    const embedObj = {
      color: "RED",
      title: `Niles Bot ${version}`,
      url: "https://github.com/niles-bot/niles",
      fields: [
        {
          name: "Servers",
          value: `${results.reduce((acc, guildCount) => acc + guildCount, 0)}`,
          inline: true
        }, {
          name: "Uptime",
          value: Duration.fromObject({ seconds: process.uptime()}).toFormat("d:hh:mm:ss"),
          inline: true
        }, {
          name: "Ping",
          value: `${(client.ws.ping).toFixed(0)} ms`,
          inline: true
        }, {
          name: "RAM Usage",
          value: `${usedMem}/${totalMem}`,
          inline: true
        }, {
          name: "System Info",
          value: `${process.platform} (${process.arch})\n${totalMem}`,
          inline: true
        }, {
          name: "Libraries",
          value: `[Discord.js](https://discord.js.org) v${discord.version}\nNode.js ${process.version}`,
          inline: true
        }, {
          name: "Links",
          value: `[Bot invite](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${client.user.id}) | [Support server invite](https://discord.gg/jNyntBn) | [GitHub](https://github.com/niles-bot/niles)`,
          inline: true
        }
      ],
      footer: { text: "Created by the Niles Bot Team" }
    };
    return channel.send({ embeds: [embedObj] });
  }).catch((err) => {
    discordLog(err);
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
  // no name passed in
  if (!newCalName) return send(channel, i18n.t("collector.exist", {name: "$t(calendarname)", old: guild.getSetting("calendarName"), lng: guild.lng }));
  // chain togeter args
  else newCalName = args.join(" "); // join
  if (newCalName.length > 256) { return send("Calendar title cannot be more than 256 characters"); }
  guild.setSetting("calendarName", newCalName);
  log(`calName | ${guild.id} | changed to ${newCalName}`);    
  return send(channel, i18n.t("calname.confirm", { newCalName, lng: guild.lng }));
}

/**
 * Sets current channel to be Calendar channel
 * @param {[String]} args - arguments passed in 
 * @param {Guild} guild - Guild to set
 * @param {Snowflake} channel - Channel to respond to
 */
function setChannel(args, guild, channel) {
  log(`setChannel | ${guild.id}`);
  if (!args[0]) {
    const guildChannelId = guild.getSetting("channelid");
    if (guildChannelId) { // if existing channel
      const guildChannel = client.channels.cache.get(guildChannelId);
      send(channel, i18n.t("setchannel.current", { name: guildChannel.name, lng: guild.lng }));
    // if no channel set
    } else { send(channel, i18n.t("setchannel.not_set", { lng: guild.lng })); }
    // no arguments
    send(channel, i18n.t("setchannel.help", { lng: guild.lng }));
  } else if (args[0] === "delete") { // remove channel
    log(`setChannel | ${guild.id} | delete`);
    guild.setSetting("channelid", "");
    send(channel, i18n.t("setchannel.delete", { lng: guild.lng }));
  } else if (args[0] === "set") {
    log(`setChannel | ${guild.id} | set: ${channel.name}`);
    // set after collecting yes
    return guild.setSetting("channelid", channel.id);
  }
}

/**
 * Set guild Locale
 * @param {[String]} args - passed in arguments 
 * @param {Guild} guild - Guild to pull or change settings for 
 * @param {Channel} channel - callback channel
 */
function setLocale(args, guild, channel) {
  log(`setLocale | ${guild.id}`);
  const currentLocale = guild.getSetting("lng");
  const locale = args[0];
  const localeRegex = new RegExp("[a-zA-Z]{2}$");
  if (!locale) { // no input
    channel.send(`The current locale is ${currentLocale} for date formatting and ${i18n.t("language", {lng: currentLocale})} for text.`);
  } else if (localeRegex.test(locale)) { // passes validation
    channel.send(`I've been setup to use ${currentLocale}, do you want to overwrite this and use ${locale}? (Please see https://nilesbot.com/locale for details) **(y/n)**`);
    log(`setLocale | ${guild.id} | set to locale: ${locale}`);
    return guild.setSetting("lng", locale);
  // fails validation
  } else {
    log(`setLocale | ${guild.id} | failed validation: ${locale}`);
    channel.send("Invalid locale, please only use an ISO 3166-1 alpha2 (https://mchang.icu/niles/locale) code");
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
    if (oldCalendarID) channel.send(i18n.t("collector.exist", { name: "$t(calendarid)", old:oldCalendarID, lng: guild.lng }));
    // no input
    else channel.send(i18n.t("collector.noarg", { name: "$t(calendarid)", lng: guild.lng, example: "`!id`, i.e. `!id 123abc@123abc.com`" }));
  }
  // did not pass blacklist
  else if (denyList.exists(newCalendarID)) {
    log(`logID | ${guild.id} | denylisted`);
    discordLog(`logID | ${guild.id} | denylisted`);
    return channel.send("calendarID change denied");
  }
  // did not pass validation
  else if (!helpers.matchCalType(newCalendarID, channel, guild)) {
    log(`logID | ${guild.id} | failed calType`);
    channel.send(i18n.t("collector.invalid", { name: "$t(calendarid)", lng: guild.lng }));
  // overwrite calendarid, passed validation
  } else if (oldCalendarID) {
    channel.send(i18n.t("collector.overwrite_prompt", { old: oldCalendarID, new: newCalendarID, lng: guild.lng }));
    log(`logID | ${guild.id} | set to newID: ${newCalendarID}`);
    return guild.setSetting("calendarID", newCalendarID);
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
  const zoneSet = new Set(zoneNames);
  const currentTz = guild.getSetting("timezone");
  const input = args.join(" "); // join arguments for parsing
  const tz = soft(input)[0];
  console.log(input);
  const newTz = zoneSet.has(input) ? input
    : tz ? tz.iana
      : false;

  if (!input) { // no input
    // no current tz
    if (!currentTz) channel.send(i18n.t("collector.noarg", { name: "$t(timezone)", lng: guild.lng, example: "`!tz America/New_York` or `!tz UTC+4` or `!tz EST`"}));
    // timezone define
    else channel.send(i18n.t("collector.exist", { name: "$t(timezone)", lng: guild.lng, old: currentTz }));
  }
  // valid input
  else if (newTz) { // tz parserd
    log(`logTz | ${guild.id} | set to new tz: ${tz}`);
    guild.setSetting("timezone", newTz);
  } else {
    log(`logID | ${guild.id} | failed validation: ${tz}`);
    channel.send(i18n.t("collector.invalid", { name: "$t(timezone)", lng: guild.lng })); }
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
  if (!newPrefix) { channel.send(i18n.t("collector.exist", { old: guild.prefix, name: "prefix", lng: guild.lng }));
  } else if (newPrefix) {
    channel.send(`Do you want to set the prefix to \`${newPrefix}\` ? **(y/n)**`);
    log(`setPrefix | ${guild.id} | set to: ${newPrefix}`);
    channel.send(`prefix set to ${newPrefix}`);
    return guild.setSetting("prefix", newPrefix);
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
  const adminRole = args.join(" ");
  const allowedRoles = guild.getSetting("allowedRoles");
  const userRoles = message.member.roles.cache.map((role) => role.name);
  const lng = guild.lng;
  let roleArray;
  if (!adminRole) {
    // no argument defined
    if (allowedRoles.length === 0) return message.channel.send(i18n.t("admin.noarg", {lng}));
    // admin role exists
    message.channel.send(i18n.t("collector.exist", { name: "$t(adminrole)", lng, old: allowedRoles}));
  } else if (adminRole) {
    // add everyone
    if (adminRole.toLowerCase() === "everyone") {
      log(`setRoles | ${guild.id} | prompt everyone`);
      message.channel.send(i18n.t("admin.prompt_everyone", {lng}));
      roleArray = [];
    // no role selected
    } else if (!userRoles.includes(adminRole)) {
      log(`setRoles | ${guild.id} | do not have role`);
      message.channel.send(i18n.t("admin.no_role", {lng}));
    } else {
      // restricting succeeded
      log(`setRoles | ${guild.id} | prompt role: ${adminRole}`);
      roleArray = [adminRole];
    }
    // prompt for confirmation
    return guild.setSetting("allowedRoles", roleArray);
  }
}

// restart shard function
/**
 * Restart targeted shard
 * @param {Client} client 
 * @param {Object} args - argument to be passed through 
 */
function restartShard(client, { shardNo }) {
  if (client.shard.ids.includes(shardNo)) process.exit();
}

/**
 * Admin-only commands
 * @param {String} cmd - command to run
 * @param {[String]} args - args of command
 * @returns {String} - response of command
 */
function adminCmd (cmd, args) {
  log(`adminCmd | cmd ${cmd} | args: ${args}`);
  if (cmd === "reset") {
    let response = "";
    const shardNo = Number(args[0]); // check for valid shard
    if (isNaN(shardNo)) { response = "Invalid shard number"; // check for valid number
    } else {
      response = `Restarting shard ${shardNo}`;
      discordLog(response);

      client.shard.broadcastEval(restartShard, {context: { arg: shardNo}});
    }
    return response;
  } else if (cmd === "debug") {
    const storePath = process.env.STORE_PATH ?? "stores";
    return {
      content: `debug for guild ${args[0]}`,
      files: [{
        attachment: `${storePath}/${args[0]}/calendar.json`,
        name: "calendar.json"
      }, {
        attachment: `${storePath}/${args[0]}/settings.json`,
        name: "settings.json"
      }]
    };
  } else if (cmd === "deny") {
    const calid = args[1];
    const cmd = args[0];
    if (cmd === "append") {
      denyList.append(calid);
      return `added ${calid}`;
    } else if (cmd === "remove") {
      denyList.remove(calid);  
      return `removed ${calid}`;
    } else if (cmd === "exists") {
      return denyList.exists(calid);
    } else {
      return "Invalid subcommand";
    }
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
  const lng = guildSettings.lng;
  const guildChannel = (guildSettings.channelid ? client.channels.cache.get(guildSettings.channelid) : channel);
  const sentByAdmin = (settings.secrets.admins.includes(message.author.id)); // check if author is admin
  log(`run | ${guildID} | cmd: ${cmd} | args: ${args}`);
  // start commands
  if (["ping"].includes(cmd)) { channel.send(`:ping_pong: !Pong! ${(client.ws.ping).toFixed(0)}ms`);
  } else if (["init"].includes(cmd)) {
    log(`init | ${guildID}`);
    channel.send(i18n.t("reset", {lng: guild.lng}));
    guilds.recreateGuild(guildID);
  } else if (["invite"].includes(cmd)) {
    const inviteEmbed = {
      description: `Click [here](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${client.user.id}) to invite me to your server`,
      color: 0xFFFFF };
    channel.send({ embeds: [inviteEmbed] });
  } else if (["admin"].includes(cmd)) { setRoles(message, args, guild);
  } else if (["prefix"].includes(cmd)) { setPrefix(channel, args, guild);
  } else if (["id"].includes(cmd)) { logID(channel, args, guild);
  } else if (["tz"].includes(cmd)) { logTz(channel, args, guild);
  // end setup mode commands
  } else if (!guildSettings.calendarID || !guildSettings.timezone) { 
    log(`setup-mode | ${guildID} | cmd: ${cmd} | args: ${args}`);
    // send setup-specific help message
    if (["help"].includes(cmd)) { i18n.t("setup.help", {lng}); }
    else if (["setup", "start"].includes(cmd)) { channel.send(i18n.t("setup.long", {lng})); }
    else { channel.send(i18n.t("setup.error", {lng})); }
  // if in setup mode, hard stop & force exit
  } else if (["help"].includes(cmd)) { channel.send(i18n.t("help", { lng }));
  } else if (["clean", "purge"].includes(cmd)) { deleteMessages(args, channel, guild.lng);
  } else if (["display"].includes(cmd)) {
    log(`display | ${guildID}`);
    getEvents(guild, guildChannel);
    postCalendar(guild, guildChannel);
  } else if (["update", "sync"].includes(cmd)) { calendarUpdater(guild, guildChannel, true);
  } else if (["create", "scrim"].includes(cmd)) {
    log(`create | ${guildID}`);
    quickAddEvent(args, guild, channel);
    calendarUpdater(guild, guildChannel, true);
  } else if (["displayoptions"].includes(cmd)) { doHandler(args, guild, channel);
  } else if (["stats", "info"].includes(cmd)) { displayStats(channel);
  } else if (["get"].includes(cmd)) { getEvents(guild, channel);
  } else if (["stop"].includes(cmd)) { killUpdateTimer(guild.id, "stop command");
  } else if (["delete"].includes(cmd)) { channel.send("delete does not work");     //deleteEvent(args, guild, channel);
  } else if (["next"].includes(cmd)) { nextEvent(guild, channel);
  } else if (["reset", "debug", "deny"].includes(cmd)) { channel.send (sentByAdmin ? adminCmd(cmd, args) : "Not Admin");
  } else if (["validate"].includes(cmd)) { validate(guild, channel);
  } else if (["calname"].includes(cmd)) { calName(args, guild, channel);
  } else if (["auth"].includes(cmd)) { setupAuth(args, guild, channel);
  } else if (["channel"].includes(cmd)) { setChannel(args, guild, channel);
  } else if (["locale"].includes(cmd)) {setLocale(args, guild,channel);
  }
  setTimeout(() => message.delete(), 10000);
}

module.exports = {
  run,
  killUpdateTimer,
  workerUpdate
};
