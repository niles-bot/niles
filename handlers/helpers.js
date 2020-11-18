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

let settings = require("../settings.js");
let bot = require("../bot.js");
let minimumPermissions = settings.secrets.minimumPermissions;

function getGuildSettings(id, file) {
  // select file
  if (file === "calendar") {
    filePath = path.join(__dirname, "..", "stores", id, "calendar.json");
  } else if (file === "settings") {
    filePath = path.join(__dirname, "..", "stores", id, "settings.json");
  }
  // read file
  let storedData = readFile(filePath);
  //merge defaults and stored settings to guarantee valid data
  let combinedData = {...defaultSettings, ...storedData };
  return combinedData
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
      if ('${logString}'.includes("Bot is logged in.") || '${logString}'.includes("error running main message handler")) {
        channel.send("<@${superAdmin}>");
      }
      console.log('${logString}'); // send to console only once to avoid multiple lines
    }
  `)
  .catch((err) => {
    console.log(err);
  });
}

function logError() {
  log("[ERROR]", Array.from(arguments).slice(1).join(" "));
}

function readFile(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    log("error reading file " + err);
    // return valid JSON to trigger update
    return {};
  }
}

function readFileSettingsDefault(filePath, defaultValue) {
  try {
    const fileData = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileData);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }

    fs.writeFileSync(filePath, defaultValue, {
      encoding: "utf8",
      flag: "wx"
    });
    return JSON.parse(defaultValue);
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
    if (!err) {
      return;
    }
    return logError("writing the guild database", err);
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
    fs.readdirSync(path).forEach(function(file, index) {
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

const userStorePath = path.join(__dirname, "..", "stores", "users.json");
const users = readFileSettingsDefault(userStorePath, "{}");

const userDefaults = {};

//uses cached version of user database
function amendUserSettings(userId, partialSettings) {
  users[userId] = Object.assign({}, users[userId], partialSettings);

  const formattedJson = JSON.stringify(users, "", "\t");
  fs.writeFile(userStorePath, formattedJson, (err) => {
    if (!err) {
      return;
    }
    return logError("writing the users database", err);
  });
}

function getUserSetting(userId, settingName) {
  const apparentSettings = Object.assing({}, userDefaults, users[userId]);
  return apparentSettings[settingName];
}


function mentioned(msg, x) {
  if (!Array.isArray(x)) {
    x = [x];
  }
  return msg.mentions.has(bot.client.user.id) && x.some((c) => msg.content.toLowerCase().includes(c));
}

function firstUpper(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
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

function sendMessageHandler(message, err) {
  if (err.message === "Missing Permissions") {
    return message.author.send("Oh no! I don't have the right permissions in the channel you're trying to use me in! Toggle on all of the 'text permissions' for the **Niles** role");
  } else {
    return log(err);
  }
}

function checkRole(message) {
  let guildSettings = getGuildSettings(message.guild.id, "settings");
  let userRoles = message.member.roles.cache.map((role) => role.name);
  if (guildSettings.allowedRoles.length === 0) {
    return true;
  }
  if (guildSettings.allowedRoles.length > 0) {
    if (userRoles.includes(guildSettings.allowedRoles[0])) {
      return true;
    } else {
      return false;
    }
  }
}

function checkPermissions(message) {
  let botPermissions = message.channel.permissionsFor(bot.client.user).serialize(true);
  let missingPermissions = "";
  minimumPermissions.forEach(function(permission) {
    if (!botPermissions[permission]) {
      missingPermissions += "\n" + String(permission);
    }
  });
  if (missingPermissions !== "") {
    return false;
  }
  return true;
}

function checkPermissionsManual(message, cmd) {
  let botPermissions = message.channel.permissionsFor(bot.client.user).serialize(true);
  let missingPermissions = "";
  minimumPermissions.forEach(function(permission) {
    if (!botPermissions[permission]) {
      missingPermissions += "\n" + String(permission);
    }
  });
  if (missingPermissions !== "") {
    return message.author.send(`Hey I noticed you tried to use the command \`\`${cmd}\`\`. I am missing the following permissions in channel **${message.channel.name}**: \`\`\`` + missingPermissions + "```" + "\nIf you want to stop getting these DMs type `!permissions 0` in this DM chat.");
  }
  return message.author.send(`I have all the permissions I need in channel **${message.channel.name}**`);
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
      let eventMatchType = eventType.NOMATCH;
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

module.exports = {
  deleteFolderRecursive,
  getGuildDatabase,
  getGuildSettings,
  removeGuildFromDatabase,
  writeGuildDatabase,
  amendGuildDatabase,
  writeGuildSpecific,
  amendUserSettings,
  getUserSetting,
  mentioned,
  firstUpper,
  validateTz,
  log,
  logError,
  readFile,
  getStringTime,
  getValidTz,
  sendMessageHandler,
  checkPermissions,
  checkPermissionsManual,
  checkRole,
  yesThenCollector,
  classifyEventMatch,
  eventType,
  defaultSettings,
  trimEventName,
  descriptionParser
};
