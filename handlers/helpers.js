const fs = require("fs");
const path = require("path");
const defer = require("promise-defer");
const { stripHtml } = require("string-strip-html");
const { DateTime, IANAZone, FixedOffsetZone } = require("luxon");
let bot = require("../bot.js");
const { oauth2, sa } = require("../settings.js");

// event types
const eventType = {
  NOMATCH: "nm",
  SINGLE: "se",
  MULTISTART: "ms",
  MULTIMID: "mm",
  MULTYEND: "me"
};
// default guild settings
const defaultSettings = {
  "prefix": "!",
  "calendarID": "",
  "calendarChannel": "",
  "calendarName": "CALENDAR",
  "timezone": "",
  "helpmenu": "1",
  "format": 12,
  "tzDisplay": "0",
  "allowedRoles": [],
  "emptydays": "1",
  "showpast": "0",
  "trim": 0,
  "days": 7,
  "style": "code",
  "inline": "0",
  "description": "0",
  "url": "0",
  "auth": "sa",
  "channelid": ""
};

function getSettings() {
  return require("../settings.js");
}

/**
 * Format log messages with DateTime string
 * [Sun, 10 Sep 2001 00:00:00 GMT]
 * @param {Snowflake} message 
 */
function formatLogMessage(message) {
  return `[${new Date().toUTCString()}] ${message}`;
}

/**
 * Log Messages to discord channel and console
 * @param  {...any} logItems - items to log
 */
function log(...logItems) {
  const logMessage = logItems.join(" ");
  const tripleGrave = "```";
  const logString = formatLogMessage(logMessage);
  const logChannelId = getSettings().secrets.log_discord_channel;
  const superAdmin = getSettings().secrets.admins[0];
  // send to all shards
  bot.client.shard.broadcastEval(`
    if (!'${logChannelId}') {
      console.log("no log channel defined");
    }
    // fetch log channel
    const channel = this.channels.cache.get('${logChannelId}');
    if (channel) { // check for channel on shard
      channel.send('${tripleGrave} ${logString} ${tripleGrave}');
      if ('${logString}'.includes("all shards spawned")) {
        channel.send("<@${superAdmin}>");
      }
      console.log('${logString}'); // send to console only once to avoid multiple lines
    }
  `)
    .catch((err) => {
      console.log(err);
    });
}


/**
 * Try and read file
 * @param {String} path - path of file to read
 */
function readFile(path) {
  try { return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    log("error reading file " + err);
    return {}; // return valid JSON to trigger update
  }
}

const guildDatabasePath = path.join(__dirname, "..", "stores", "guilddatabase.json");
let guildDatabase;

/**
 * Fetch current guilds database if already loaded or read from file
 */
function getGuildDatabase() {
  return guildDatabase || readFile(guildDatabasePath);
}

/**
 * Write changes to guilds database
 */
function writeGuildDatabase() {
  const formattedJson = JSON.stringify(guildDatabase, "", "\t");
  fs.writeFile(guildDatabasePath, formattedJson, (err) => {
    if (err) return log("writing the guild database", err);
  });
}

/**
 * Add values to guilds database
 * @param {Object} partialGuildDb - Objects to add to guilds database
 */
function amendGuildDatabase(partialGuildDb) {
  Object.assign(guildDatabase, partialGuildDb);
  writeGuildDatabase();
}

/**
 * Remove guild from guilds database
 * @param {String} guildId 
 */
function removeGuildFromDatabase(guildId) {
  delete guildDatabase[guildId];
  writeGuildDatabase();
}

/**
 * Delete folder recursively
 * @param {String} path 
 */
function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.rmdirSync(path, {recursive: true});
  }
}

// timezone validation
function validateTz(tz) {
  return (IANAZone.isValidZone(tz) || (FixedOffsetZone.parseSpecifier(tz) !== null && FixedOffsetZone.parseSpecifier(tz).isValid));
}

/**
 * Writes guild-specific setting
 * @param {String} guildid - ID of guild to write setting to 
 * @param {Object} json - json array of values to write
 * @param {String} file - file name to write to - calendar/settings 
 */
function writeGuildSpecific(guildid, json, file) {
  let fullPath = path.join(__dirname, "..", "stores", guildid, file + ".json");
  fs.writeFile(fullPath, JSON.stringify(json, "", "\t"), (err) => {
    if (err) return log("error writing guild specific database: " + err);
  });
}

function getGuildSpecific(guildid, file) {
  let filePath = path.join(__dirname, "..", "stores", guildid, file);
  let storedData = readFile(filePath);
  // merge defaults and stored settings to guarantee valid data - only for settings
  return (file === "settings.json" ? {...defaultSettings, ...storedData} : storedData);
}

function Guild(guildid) {
  // settings
  let settings = getGuildSpecific(guildid, "settings.json");
  /**
   * Get settings
   * @param {String} [key] - Optional key to fetch 
   */
  this.getSetting = (key) => {
    return (key ? settings[key] : settings);
  };
  /**
   * Sets specific setting to value
   * @param {String} key - key of setting to change
   * @param {String} value - value to set key to
   */
  this.setSetting = (key, value) => { // set settings value
    settings[key] = value;
    writeGuildSpecific(guildid, settings, "settings");
  };
  /**
   * Set all settings
   * @param {Object} newSettings - new settings object
   */
  this.setSettings = (newSettings) => { writeGuildSpecific(guildid, newSettings, "settings"); };
  // common settings
  this.prefix = settings.prefix;
  this.id = guildid;
  // calendar
  let calendar = getGuildSpecific(guildid, "calendar.json");
  /**
   * Get calendar file
   * @param {String} [key] - Optionally get specific key 
   */
  this.getCalendar = (key) => { return (key ? calendar[key] : calendar); };
  /**
   * Set Calendar to value
   * @param {Object} [argCalendar] - If provided, set to given calendar, else write current calendar
   */
  this.setCalendar = (argCalendar = calendar) => {
    writeGuildSpecific(guildid, argCalendar, "calendar");
    calendar = argCalendar;
  };
  // calendarID
  /**
   * Set Calendar Message ID
   * @param {String} calendarID - ID of calendar message 
   */
  this.setCalendarID = (calendarID) => {
    calendar.calendarMessageId = calendarID;
    this.setCalendar();
  };
  // daymap
  this.getDayMap = () => {
    let dayMap = [];
    // allowing all days to be correctly TZ adjusted
    let d = DateTime.fromJSDate(new Date()).setZone(this.getTz());
    // if Option to show past events is set, start at startOf Day instead of NOW()
    if (settings.showpast === "1") d = d.startOf("day");
    dayMap[0] =  d;
    for (let i = 1; i < settings.days; i++) {
      dayMap[i] = d.plus({ days: i }); //DateTime is immutable, this creates new objects!
    }
    return dayMap;
  };
  /**
   * Get OAuth2 token
   */
  this.getToken = () => getGuildSpecific(guildid, "token.json");
  /**
   * Set OAuth2 token
   * @param {Object} token - token object to write
   */
  this.setToken = (token) => writeGuildSpecific(guildid, token, "token");
  /**
   * Gets guild authentication
   * @returns return googleAuth object
   */
  this.getAuth = () => {
    if (settings.auth === "oauth") {
      oauth2.setCredentials(this.getToken());
      return oauth2;
    // default to SA if oauth2 failed too
    } else { return sa;
    }
  };
  /**
   * Get valid tz
   */
  this.getTz = () => { return (validateTz(settings.timezone) ? settings.timezone : "UTC"); };
}

/**
 * Make a guild setting formatted time string from timezone adjusted date object
 * @param {string} date - ISO datetimestring
 * @param {Guild} guild - Guild to get settings from
 * @return {string} - nicely formatted string for date event
 */
function getStringTime(date, guild) {
  const format = guild.getSetting("format");
  const zDate = DateTime.fromISO(date, {setZone: true});
  return zDate.toLocaleString({ hour: "2-digit", minute: "2-digit", hour12: (format === 12) });
}

/**
 * Checks if user has required roles
 * @param {Snowflake} message - message from user to be checked
 * @returns {bool} - return if no allowed roles or user has role
 */
function checkRole(message) {
  const guild = new Guild(message.guild.id);
  const allowedRoles = guild.getSetting("allowedRoles");
  const userRoles = message.member.roles.cache.map((role) => role.name); // roles of user
  return (allowedRoles.length === 0 || userRoles.includes(allowedRoles[0]));
}


/**
 * Collects response for a message
 * @param {Snowflake} channel - Channel to create collector in
 */
function yesThenCollector(channel) {
  let p = defer();
  const collector = channel.createMessageCollector((msg) => !msg.author.bot, { time: 30000 });
  collector.on("collect", (m) => {
    if (["y", "yes"].includes(m.content.toLowerCase())) { p.resolve();
    } else {
      channel.send("Okay, I won't do that");
      p.reject();
    }
    collector.stop();
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") return channel.send("Command response timeout");
  });
  return p.promise;
}

/**
 * This function returns a classification of type 'eventType' to state the relation between a date and an event.
 * You can only check for the DAY relation, of checkDate, not the full dateTime relation!
 * @param {DateTime} checkDate - the Date to classify for an event
 * @param {DateTime} eventStartDate - the start Date() of an event
 * @param {DateTime} eventEndDate - the end Date() of an event
 * @return {string} eventType - A string of ENUM(eventType) representing the relation
 */
function classifyEventMatch(checkDate, eventStartDate, eventEndDate) {
  let eventMatchType = eventType.NOMATCH;
  // simple single day event
  if (checkDate.hasSame(eventStartDate, "day") && eventStartDate.hasSame(eventEndDate, "day")){
    eventMatchType = eventType.SINGLE;
  } else if (!eventStartDate.hasSame(eventEndDate, "day")) { // multi-day event
    // special case, Event ends as 12 AM spot on
    if (checkDate.hasSame(eventStartDate, "day") && eventEndDate.diff(eventStartDate.endOf("day"),"minutes") <= 1){
      eventMatchType = eventType.SINGLE;
    } else if (eventEndDate.diff(checkDate.startOf("day"),"minutes") <= 1){
      // this removes the entry for the next day of a 12AM ending event
      eventMatchType = eventType.NOMATCH;
    } else if (checkDate.hasSame(eventStartDate, "day")) {
      eventMatchType = eventType.MULTISTART;
    } else if (checkDate.hasSame(eventEndDate, "day")){
      eventMatchType = eventType.MULTYEND;
    } else if (checkDate.startOf("day") > eventStartDate.startOf("day") && checkDate.startOf("day") < eventEndDate.startOf("day") && eventEndDate.diff(checkDate.endOf("day"),"minutes") <= 1){
      // this makes the 12AM ending multi-day events show as ""..... - 12:00 AM"
      eventMatchType = eventType.MULTYEND;
    } else if (checkDate.startOf("day") > eventStartDate.startOf("day") && checkDate.startOf("day") < eventEndDate.startOf("day")){
      eventMatchType = eventType.MULTIMID;
    } 
  }
  return eventMatchType;
}

/**
 * This helper function limits the amount of chars in a string to max trimLength and adds "..." if shortened.
 * @param {string} eventName - The name/summary of an event
 * @param {int} trimLength - the number of chars to trim the title to
 * @return {string} eventName - A string wit max 23 chars length
 */
function trimEventName(eventName, trimLength){
  // if no trim length, just return
  if (trimLength === null || trimLength === 0) return eventName;
  // trim down to length
  if (eventName.length > trimLength) eventName = eventName.trim().substring(0, trimLength-3) + "...";
  return eventName;
}

/**
 * this helper function strips all html formatting from the description.
 * @param {string} inputString - the unclean string
 * @return {string} strippedString - string stripped of html
 */
function descriptionParser(inputString) {
  const decoded = decodeURI(inputString); // decode URI
  const replaced = decoded.replace(/(<br>)+/g, "\n"); // replace <br> with \n
  const { result } = stripHtml(replaced);
  return result;
}

/**
 * This function makes sure that the calendar matches a specified type
 * @param {String} calendarId - calendar ID to classify
 *  @param {Snowflake} channel - Channel to send callback to
 * @returns {bool} - if calendar ID is valid
 */
function matchCalType(calendarId, channel) {
  // regex filter groups
  const groupCalId = RegExp("([a-z0-9]{26}@group.calendar.google.com)");
  const cGroupCalId = RegExp("^(c_[a-z0-9]{26}@)");
  const importCalId = RegExp("(^[a-z0-9]{32}@import.calendar.google.com)");
  const gmailAddress = RegExp("^([a-z0-9.]+@gmail.com)");
  const underscoreCalId = RegExp("^[a-z0-9](_[a-z0-9]{26}@)");
  const domainCalId = RegExp("^([a-z0-9.]+_[a-z0-9]{26}@)");
  const domainAddress = RegExp("(^[a-z0-9_.+-]+@[a-z0-9-]+.[a-z0-9-.]+$)");
  // filter through regex
  if (gmailAddress.test(calendarId)) { // matches gmail
  } else if (importCalId.test(calendarId)) { // matches import ID
  } else if (groupCalId.test(calendarId)) {
    if (cGroupCalId.test(calendarId)) { // matches cGroup
    } else if (domainCalId.test(calendarId)) {channel.send("If you are on a GSuite/ Workplace and having issues see https://nilesbot.com/start/#gsuiteworkplace");
    } else if (underscoreCalId.test(calendarId)) { channel.send("If you are having issues adding your calendar see https://nilesbot.com/start/#new-calendar-format");
    }
    return true; // normal group id or any variation
  } else if (domainAddress.test(calendarId)) { channel.send("If you are on a GSuite/ Workplace and having issues see https://nilesbot.com/start/#gsuiteworkplace");
  } else { return false; // break and return false
  }
  return true; // if did not reach false
}

module.exports = {
  deleteFolderRecursive,
  getGuildDatabase,
  removeGuildFromDatabase,
  amendGuildDatabase,
  writeGuildSpecific,
  validateTz,
  log,
  getStringTime,
  checkRole,
  yesThenCollector,
  classifyEventMatch,
  eventType,
  defaultSettings,
  trimEventName,
  descriptionParser,
  matchCalType,
  Guild
};
