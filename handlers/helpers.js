const fs = require("fs");
const path = require("path");
const defer = require("promise-defer");
const moment = require("moment-timezone");
const eventType = {
  NOMATCH: "nm",
  SINGLE: "se",
  MULTISTART: "ms",
  MULTIMID: "mm",
  MULTYEND: "me"
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
  return readFile(filePath);
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

function fullname(user) {
  return `${user.username}#${user.discriminator}`;
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
const validateTz = (timezone) => { return moment.tz.zone(timezone); };

// parse timezone and adjust time
function addTz(time, timezone) {
  if (validateTz(timezone)) { // passes moment timezone test
    return moment.parseZone(time).tz(timezone);
  } else { // does not pass moment timezone test (old timezone)
    return moment.parseZone(time).utcOffset(timezone);
  }
}

function momentDate(time, guildid) {
  let guildSettings = getGuildSettings(guildid, "settings");
  return addTz(time, guildSettings.timezone);
}

// returns date object adjusted for tz
function convertDate(dateToConvert, guildid) {
  let guildSettings = getGuildSettings(guildid, "settings");
  return addTz(dateToConvert, guildSettings.timezone).utc(true).toDate();
}

function stringDate(date, guildid, hour) {
  let guildSettings = getGuildSettings(guildid, "settings");
  return addTz(date, guildSettings.timezone).toISOString(true);
}

function getStringTime(date, format) {
  // m.format(hA:mm) - 9:05AM
  // m.format(HH:mm) - 09:05
  const m = moment(date); // no parsezone since we are passing in a moment object
  if (m.minutes() === 0) { // if on the hour
    return ((format === 24) ? m.format("HH") : m.format("hA"));
  } else { // if not on the hour
    return ((format === 24) ? m.format("HH:mm") : m.format("h:mmA"));
  }
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
 * @param {Date} checkDate - the Date to classify for an event
 * @param {Date} eventStartDate - the start Date() of an event
 * @param {Date} eventEndDate - the end Date() of an event
 * @return {string} eventType - A string of ENUM(eventType) representing the relation
 */
function classifyEventMatch(checkDate, eventStartDate, eventEndDate) {
  // remove the time to prevent call-time dependant issues
  let lCheckDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
  let lEventStartDate = new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate());
  let lEventEndDate = new Date(eventEndDate.getFullYear(), eventEndDate.getMonth(), eventEndDate.getDate());
  let eventMatchType = eventType.NOMATCH;
  // simple single day event
  if(moment(lCheckDate).isSame(lEventStartDate) && moment(lEventStartDate).isSame(lEventEndDate)){
    eventMatchType = eventType.SINGLE;
  }
  // multi-day event
  else if(!moment(lEventStartDate).isSame(lEventEndDate))
  {
    if(moment(lCheckDate).isSame(lEventStartDate)){
      eventMatchType = eventType.MULTISTART;
    }
    else if(moment(lCheckDate).isSame(lEventEndDate)){
      eventMatchType = eventType.MULTYEND;
    } 
    else if(moment(lCheckDate).isAfter(lEventStartDate) && moment(lCheckDate).isBefore(lEventEndDate)){
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


module.exports = {
  fullname,
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
  stringDate,
  momentDate,
  convertDate,
  sendMessageHandler,
  checkPermissions,
  checkPermissionsManual,
  checkRole,
  yesThenCollector,
  classifyEventMatch,
  eventType,
  trimEventName
};
