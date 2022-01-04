// package imports
const columnify = require("columnify");
const { DateTime } = require("luxon");
const debug = require("debug")("niles:cmd");
const discord = require("discord.js");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const eventType = require("~/handlers/eventHelper.js").eventType;
const { i18n } = require("~/handlers/strings.js");
const updaterList = require("~/handlers/updaterList.js");

/**
 * Determines if a calendar is empty
 * @param {Guild} guild - Guild to pull calendar from
 * @param {dayMap} dayMap - daymap to reference agianst
 */
function isEmptyCalendar(guild, dayMap) {
  debug(`isEmptyCalendar | ${guild.id}`);
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
 * This helper function limits the amount of chars in a string to max trimLength and adds "..." if shortened.
 * @param {string} eventName - The name/summary of an event
 * @param {int} trimLength - the number of chars to trim the title to
 * @return {string} eventName - A string wit max 23 chars length
 */
function trimEventName(eventName, trimLength){
  debug(`trimEventName | eventname: ${eventName}`);
  // remove json invalids
  eventName = eventName.replace("[\\.$|`|']/g", "\"");
  // if no trim length, just return
  if (trimLength === null || trimLength === 0) return eventName;
  // trim down to length
  if (eventName.length > trimLength) eventName = eventName.trim().substring(0, trimLength-3) + "...";
  return eventName;
}

/**
 * Make a guild setting formatted time string from timezone adjusted date object
 * @param {string} date - ISO datetimestring
 * @param {Guild} guild - Guild to get settings from
 * @return {string} - nicely formatted string for date event
 */
function getStringTime(date, guild) {
  debug(`getStringTime | ${guild.id}`);
  const format = guild.getSetting("format");
  const zDate = DateTime.fromISO(date, {setZone: true});
  return zDate.toLocaleString({
    hour: "2-digit",
    minute: "2-digit",
    hour12: (format === 12),
    locale: guild.lng
  });
}

/**
 * Create appropiate description
 * @param {Object} event - Event Resources from GCal 
 * @param {Object} guildSettings - guild settings
 */
function createEventName(event, guildSettings) {
  debug("createEventName");
  const titleName = event.summary ? trimEventName(event.summary, guildSettings.trim) : " ";
  const urlPattern = new RegExp("^https?://");
  // if location is url & setting is on
  const addURL = (urlPattern.test(event.location) && guildSettings.url === "1");
  debug(`createEventName | url: ${addURL}`);
  return addURL ? `[${titleName}](${event.location})` : titleName;
}

/**
 * Creates duration string
 * @param {Event} event - Event to create for
 * @param {Guild} guild - guild to pull settings from
 * @returns {String}
 */
function createDurationString(event, guild) {
  // check for early exit condition
  // middle of multi-day or no time, must be "All Day"
  if (Object.keys(event.start).includes("date") || event.type === eventType.MULTIMID) return "All Day";
  // event must have dateTime
  const { format, startonly } = guild.getSetting();
  let tempStartDate = format === 24 ? "....." : "........";
  let tempFinDate = format === 24 ? "....." : "........";
  if (event.type === eventType.SINGLE || event.type === eventType.MULTISTART) {
    tempStartDate = getStringTime(event.start.dateTime, guild);
  }
  if (event.type === eventType.SINGLE || event.type === eventType.MULTYEND) {
    tempFinDate = getStringTime(event.end.dateTime, guild);
  }
  return (startonly === "1" ? tempStartDate : tempStartDate + " - " + tempFinDate); // optionally only show start time
}

/**
 * Generate codeblock messsage for calendar display
 * @param {Guild} guild - guild to create for
 */
function createCalendarCodeblock(guild) {
  debug(`createCalendarCodeblock | ${guild.id}`);
  const guildCalendar = guild.getCalendar("events");
  const guildSettings = guild.getSetting();
  const dayMap = guild.getDayMap();
  let finalString = "";
  for (let i = 0; i < dayMap.length; i++) {
    let key = "day" + String(i);
    let sendString = "";
    sendString += "\n**" + dayMap[i].toLocaleString({ weekday: "long", locale: guild.lng }) + "** - "+ dayMap[i].toLocaleString({ month: "long", day: "2-digit", locale: guild.lng });
    // if there are no events on the day
    if (guildCalendar[key].length === 0) {
      // if empty days hidden, skip day
      if (guildSettings.emptydays === "0") continue;
      // otherwise just send empty string
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
        const eventTitle = (event.summary) ? trimEventName(event.summary, guildSettings.trim) : " ";
        const duration = createDurationString(event, guild);
        const tempString = {[duration]: eventTitle};
        sendString += (guildSettings.eventtime === "1" ? columnify(tempString, options) + "\n" : eventTitle + "\n");
      });
      sendString += "```";
    }
    finalString += sendString;
  }
  // log(`createCalendarCodeblock | ${guild.id}| finalString ${finalString}`);
  return finalString; // return finalstring to createCalendar
}

/**
 * Create event strings for emebeds
 * @param {Event} event - Event to create strings for
 * @param {Guild} guild - guild with settings to pull from
 * @Returns {String} - constructed event string
 */
function embedEventString(event, guild) {
  const guildSettings = guild.getSetting();
  const duration = createDurationString(event, guild);
  const eventTitle = createEventName(event, guildSettings); // add link if there is a location
  let eventString = (guildSettings.eventtime === "1" ? `**${duration}** | ${eventTitle}\n`: `${eventTitle}\n`);
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
 * @param {[Event]} events - Events to create embed for
 */
function generateCalendarEmbed(guild, events) {
  debug(`generateCalendarEmbed | ${guild.id}`);
  let guildSettings = guild.getSetting();
  const dayMap = guild.getDayMap();
  let msgLength = 0;
  let fields = [];
  for (let i = 0; i < dayMap.length; i++) {
    let tempValue = "";
    let fieldObj = {
      name: "**" + dayMap[i].toLocaleString({ weekday: "long", locale: guild.lng }) + "** - " + dayMap[i].toLocaleString({ month: "long", day: "2-digit", locale: guild.lng }),
      inline: (guildSettings.inline === "1")
    };
    if (guildSettings.emptydays === "0" && events[i].length === 0) continue;
    if (events[i].length === 0) tempValue = "\u200b";
    else {
      // Map events for each day
      events[i].forEach((event) => {
        tempValue += embedEventString(event, guild);
      });
    }
    // finalize field object
    // log(`generateCalendarEmbed | ${guild.id} | value ${tempValue}`);
    fieldObj.value = tempValue;
    // add to msgLength
    msgLength += tempValue.length;
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
  debug(`generateCalendar | ${guild.id}`);
  const dayMap = guild.getDayMap();
  const guildSettings = guild.getSetting();
  // announcement channels are not supported https://git.io/JsGcy
  if (channel.type === "news") {
    channel.send(i18n.t("announcement", { lng: guild.lng }));
    return updaterList.killUpdateTimer(guild.id, "news channel");
  }
  // create embed
  let embed = new discord.MessageEmbed();
  embed.setTitle(guildSettings.calendarName)
    .setURL("https://calendar.google.com/calendar/embed?src=" + guildSettings.calendarID)
    .setColor("BLUE")
    .setFooter("Last update")
    .setTimestamp();
  // set description or fields
  if (isEmptyCalendar(guild, dayMap)) {
    embed.setDescription("```No Upcoming Events```");
  } else if (guildSettings.style === "code") {
    embed.setDescription(createCalendarCodeblock(guild));
    //Handle Calendars Greater Than 2048 Characters Long
    if (embed.length>2048) {
      channel.send(i18n.t("calendar.too_long", { lng: guild.lng }));
      return 2048;
    }
  } else if (guildSettings.style === "embed") {
    embed.fields = generateCalendarEmbed(guild, events);
  }
  // add help message
  if (guildSettings.helpmenu === "1") {
    embed.addField(i18n.t("calendar.embed.help_title", { lng: guild.lng }), i18n.t("calendar.embed.help_desc", { lng: guild.lng }), false);
  }
  // display timezone
  if (guildSettings.tzDisplay === "1") {
    embed.addField("Timezone", guildSettings.timezone, false);
  }
  return embed;
}

/**
 * Post calendar in message channel
 * @param {Guild} guild - Guild to post relative to
 * @param {Snowflake} channel - Initiating channel
 */
function postCalendar(guild, channel, events) {
  debug(`postCalendar | ${guild.id}`);
  const guildCalendarMessageID = guild.getCalendar("calendarMessageId");
  if (guildCalendarMessageID) {
    channel.messages.fetch(guildCalendarMessageID)
      .then((message) => message.delete())
      .catch((err) => discordLog(`error fetching previous calendar in guild: ${guild.id} : ${err}`));
  }
  const embed = generateCalendar(guild, channel);
  if (embed === 2048) return null;
  channel.send({ embed }).then((sent) => {
    debug(`postCalendar | ${guild.id} | calID ${sent.id}`);
    guild.setCalendarID(sent.id);
    if (guild.getSetting("pin") === "1") sent.pin();
  }).catch((err) => {
    if (err===2048) discordLog(`function postCalendar error in guild: ${guild.id} : ${err} - Calendar too long`);
    discordLog(`function postCalendar error in guild: ${guild.id} : ${err}`);
  });
  updaterList.startUpdateTimer(guild.id, channel.id);
}

/**
 * Updates calendar
 * @param {Guild} guild - Guild to fetch from
 * @param {Snowflake} channel - Channel to respond to
 * @param {bool} human - if command was initiated by a human
 */
function updateCalendar(guild, channel, human) {
  debug(`updateCalendar | ${guild.id}`);
  guild.update(); // update guild
  const guildCalendarMessageID = guild.getCalendar("calendarMessageId");
  if (!guildCalendarMessageID) {
    channel.send(i18n.t("update.undefined", { lng: guild.lng }));
    discordLog(`calendar undefined in ${guild.id}. Killing update timer.`);
    return updaterList.killUpdateTimer(guild.id, "calendar undefined");
  }
  const embed = generateCalendar(guild, channel);
  if (embed === 2048) return null;
  channel.messages.fetch(guildCalendarMessageID)
    .then((m) => m.edit({ embed }))
    .catch((err) => {
      debug(`updateCalendar | ${err}`);
      discordLog(`error fetching previous calendar message in guild: ${guild.id} : ${err}`);
      // If theres an updater running try and kill it.
      channel.send(i18n.t("timerkilled", { lng: guild.lng }));
      channel.send(i18n.t("update.not_found", { lng: guild.lng }));
      updaterList.killUpdateTimer(guild.id, "previous not found");
      return guild.setCalendarID("");
    });
  // if everything went well, set lastUpdate
  guild.setCalendarLastUpdate(new Date());
  // if no errors thrown and not on updaterlist, start timer
  if (!updaterList.exists(guild.id) && human) updaterList.startUpdateTimer(guild.id, channel.id);
}

module.export = {
  updateCalendar,
  postCalendar
};
