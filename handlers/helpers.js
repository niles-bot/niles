const fs = require("fs");
const path = require("path");
const defer = require("promise-defer");
const stripHtml = require("string-strip-html");
const { DateTime, IANAZone, FixedOffsetZone } = require("luxon");
const eventType = {
  NOMATCH: "nm",
  SINGLE: "se",
  MULTISTART: "ms",
  MULTIMID: "mm",
  MULTYEND: "me"
};
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
  "description": "0"
};

let bot = require("../bot.js");

function getGuildSettings(id, file) {
  // select file
  let filePath;
  if (file === "calendar") {
    filePath = path.join(__dirname, "..", "stores", id, "calendar.json");
    return readFile(filePath);
  } else if (file === "settings") {
    filePath = path.join(__dirname, "..", "stores", id, "settings.json");
    let storedData = readFile(filePath);
    //merge defaults and stored settings to guarantee valid data
    return {...defaultSettings, ...storedData };
  }
}

function getSettings() {
  return require("../settings.js");
}

function formatLogMessage(message) {
  return `[${new Date().toUTCString()}] ${message}`;
}

function log(...logItems) {
  const logMessage = logItems.join(" ");
  const tripleGrave = "```";
  const logString = formatLogMessage(logMessage);
  const logChannelId = getSettings().secrets.log_discord_channel;
  const superAdmin = getSettings().secrets.super_admin;
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

function readFile(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    log("error reading file " + err);
    return {}; // return valid JSON to trigger update
  }
}

const guildDatabasePath = path.join(__dirname, "..", "stores", "guilddatabase.json");
let guildDatabase;

function getGuildDatabase() {
  guildDatabase = guildDatabase || readFile(guildDatabasePath);
  return guildDatabase;
}

function writeGuildDatabase() {
  const formattedJson = JSON.stringify(guildDatabase, "", "\t");
  fs.writeFile(guildDatabasePath, formattedJson, (err) => {
    if (err) {
      return log("writing the guild database", err);
    }
  });
}

function amendGuildDatabase(partialGuildDb) {
  Object.assign(guildDatabase, partialGuildDb);
  writeGuildDatabase();
}

function removeGuildFromDatabase(guildId) {
  delete guildDatabase[guildId];
  writeGuildDatabase();
}

function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

function writeGuildSpecific(guildid, json, file) {
  let fullPath = path.join(__dirname, "..", "stores", guildid, file + ".json");
  fs.writeFile(fullPath, JSON.stringify(json, "", "\t"), (err) => {
    if (err) {
      return log("error writing guild specific database: " + err);
    }
  });
}

// timezone validation
function validateTz(tz) {
  return (IANAZone.isValidZone(tz) || (FixedOffsetZone.parseSpecifier(tz) !== null && FixedOffsetZone.parseSpecifier(tz).isValid));
}

/**
 * get a valid Timezone (fallback to UTC if config option is inval)
 * @param {number} guildid - Guild ID to get settings from
 * @return {string} - valid IANAZone formatted timezone
 */
function getValidTz(guildid) {
  let guildSettings = getGuildSettings(guildid, "settings");
  return validateTz(guildSettings.timezone) ? guildSettings.timezone : "UTC";
}

/**
 * Make a guild setting formatted time string from timezone adjusted date object
 * @param {string} date - ISO datetimestring
 * @param {Snowflake} guildid - Guild ID to get settings from
 * @return {string} - nicely formatted string for date event
 */
function getStringTime(date, guildid) {
  let guildSettings = getGuildSettings(guildid, "settings");
  let format = guildSettings.format;
  let zDate = DateTime.fromISO(date, {setZone: true});
  return zDate.toLocaleString({ hour: "2-digit", minute: "2-digit", hour12: (format === 12) });
}

/**
 * Checks if user has required roles
 * @param {Snowflake} message - message from user to be checked
 * @returns {bool} - return if no allowed roles or user has role
 */
function checkRole(message) {
  let allowedRoles = getGuildSettings(message.guild.id, "settings").allowedRoles;
  let userRoles = message.member.roles.cache.map((role) => role.name); // roles of user
  return (allowedRoles.length === 0 || userRoles.includes(allowedRoles[0]));
}

function yesThenCollector(message) {
  let p = defer();
  const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, {
    time: 30000
  });
  collector.on("collect", (m) => {
    if (["y", "yes"].includes(m.content.toLowerCase())) {
      p.resolve();
    } else {
      message.channel.send("Okay, I won't do that");
      p.reject();
    }
    collector.stop();
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") {
      return message.channel.send("Command response timeout");
    }
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
  if(checkDate.hasSame(eventStartDate, "day") && eventStartDate.hasSame(eventEndDate, "day")){
    eventMatchType = eventType.SINGLE;
  }
  // multi-day event
  else if(!eventStartDate.hasSame(eventEndDate, "day"))
  {
    // special case, Event ends as 12 AM spot on
    if(checkDate.hasSame(eventStartDate, "day") && eventEndDate.diff(eventStartDate.endOf("day"),"minutes") <= 1){
      eventMatchType = eventType.SINGLE;
    }
    // this removes the entry for the next day of a 12AM ending event
    else if (eventEndDate.diff(checkDate.startOf("day"),"minutes") <= 1){
      eventMatchType = eventType.NOMATCH;
    }
    else if(checkDate.hasSame(eventStartDate, "day")){
      eventMatchType = eventType.MULTISTART;
    }
    else if(checkDate.hasSame(eventEndDate, "day")){
      eventMatchType = eventType.MULTYEND;
    } 
    // this makes the 12AM ending multi-day events show as ""..... - 12:00 AM"
    else if(checkDate.startOf("day") > eventStartDate.startOf("day") && checkDate.startOf("day") < eventEndDate.startOf("day") && eventEndDate.diff(checkDate.endOf("day"),"minutes") <= 1){
      eventMatchType = eventType.MULTYEND;
    } 
    else if(checkDate.startOf("day") > eventStartDate.startOf("day") && checkDate.startOf("day") < eventEndDate.startOf("day")){
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
  if(trimLength === null || trimLength === 0){
    return eventName;
  }
  if(eventName.length > trimLength){
    eventName = eventName.trim().substring(0, trimLength-3) + "...";
  }
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
  return stripHtml(replaced).result; // strip html
}

/**
 * This function makes sure that the calendar matches a specified type
 * @param {Snowflake} [message] - message to send warnings
 * @param {String} calendarId - calendar ID to classify
 * @returns {bool} - if calendar ID is valid
 */
function matchCalType(calendarId, message) {
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
    } else if (domainCalId.test(calendarId)) {
      if (message) message.channel.send("If you are on a GSuite/ Workplace and having issues see https://nilesbot.com/start/#gsuiteworkplace");
    } else if (underscoreCalId.test(calendarId)) {
      if (message) message.channel.send("If you are having issues adding your calendar see https://nilesbot.com/start/#new-calendar-format");
    }
    return true; // normal group id or any variation
  } else if (domainAddress.test(calendarId)) {
    if (message) message.channel.send("If you are on a GSuite/ Workplace and having issues see https://nilesbot.com/start/#gsuiteworkplace");
  } else {
    return false; // break and return false
  }
  return true; // if did not reach false
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
 * @param {Snowflake} message - message to check permissions agianst
 * @returns {String} - returns missing permissions (if any)
 */
function permissionCheck(message) {
  const minimumPermissions = ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "EMBED_LINKS", "ATTACH_FILES", "READ_MESSAGE_HISTORY"];
  const botPermissions = message.channel.permissionsFor(bot.client.user).serialize(true);
  let missingPermissions = "";
  minimumPermissions.forEach(function(permission) {
    if (!botPermissions[permission]) {
      missingPermissions += `\`${String(permission)} \``;
    }
  });
  return (missingPermissions ? missingPermissions : "None 🟢");
}

/**
 * Checks for any issues with guild configuration
 * @param {Snowflake} message - message for guild to check agianst
 * @param {Calendar} cal - Calendar API to check event agaianst
 */
function validate(message, arg, cal) {
  let guildSettings = getGuildSettings(message.guild.id, "settings");
  const nowTime = DateTime.local();
    let params = {
      timeMin: nowTime.toISO(),
      maxResults: 1
    };
    let calTest = cal.Events.list(guildSettings.calendarID, params).then((events) => {
      // print next event
      const event = events[0];
      message.channel.send(`**Next Event:**
        **Summary:** \`${event.summary}\`
        **Start:** \`${event.start.dateTime || event.start.date }\`
        **Calendar ID:** \`${event.organizer.email}\`
      `);
      return true;
    }).catch((err) => {
      message.channel.send(`Error Fetching Calendar: ${err}`);
    });
    // basic check
    message.channel.send(`**Checks**:
      **Timezone:** ${passFail(validateTz(guildSettings.timezone))}
      **Calendar ID:** ${passFail(matchCalType(guildSettings.calendarID, message))}
      **Calendar Test:** ${passFail(calTest)}
      **Missing Permissions:** ${permissionCheck(message)}
      **Guild ID:** \`${message.guild.id}\`
    `);
}

module.exports = {
  deleteFolderRecursive,
  getGuildDatabase,
  getGuildSettings,
  removeGuildFromDatabase,
  writeGuildDatabase,
  amendGuildDatabase,
  writeGuildSpecific,
  validateTz,
  log,
  readFile,
  getStringTime,
  getValidTz,
  checkRole,
  yesThenCollector,
  classifyEventMatch,
  eventType,
  defaultSettings,
  trimEventName,
  descriptionParser,
  matchCalType,
  validate
};
