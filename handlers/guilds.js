const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
const { oauth2, sa } = require("../settings.js");
const helpers = require("./helpers.js");
const log = require("debug")("niles:guilds");

const emptyCal = {
  "day0": [],
  "day1": [],
  "day2": [],
  "day3": [],
  "day4": [],
  "day5": [],
  "day6": [],
  "lastUpdate": "",
  "calendarMessageId": ""
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
  "channelid": "",
  "descLength": 0,
  "startonly": "0"
};

/**
 * Delete folder recursively
 * @param {String} path 
 */
function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.rmdirSync(path, {recursive: true});
  }
}

/**
 * Writes guild-specific setting
 * @param {String} guildID - ID of guild to write setting to 
 * @param {Object} json - json array of values to write
 * @param {String} file - file name to write to - calendar/settings 
 */
function writeGuildSpecific(guildID, json, file) {
  log(`writeGuildSpecific | ${guildID} | json: ${json} | file: ${file}`);
  let fullPath = path.join(__dirname, "..", "stores", guildID, file + ".json");
  fs.writeFile(fullPath, JSON.stringify(json, "", "\t"), (err) => {
    if (err) return helpers.log("error writing guild specific database: " + err);
  });
}

/**
 * Create new guild files
 * @param {String} guildID - Guild to create files for
 */
function createGuild(guildID) {
  const guildPath = path.join(__dirname, "..", "stores", guildID);
  if (!fs.existsSync(guildPath)) { // create directory and new files
    fs.mkdirSync(guildPath); 
    writeGuildSpecific(guildID, emptyCal, "calendar");
    writeGuildSpecific(guildID, helpers.defaultSettings, "settings");
    helpers.log(`Guild ${guildID} has been created`);
  }
}

/**
 * Delete guild settings
 * @param {String} guildID - guild to delete configuration for
 */
function deleteGuild(guildID) {
  const guildPath = path.join(__dirname, "..", "stores", guildID);
  deleteFolderRecursive(guildPath);
  helpers.log(`Guild ${guildID} has been deleted`);
}

/**
 * Delete and recreate guild settings
 * @param {StringDecoder} guildID 
 */
function recreateGuild(guildID) {
  deleteGuild(guildID);
  createGuild(guildID);
}

/**
 * Try and read file
 * @param {String} path - path of file to read
 */
function readFile(path) {
  try { return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    helpers.log("error reading file " + err);
    return {}; // return valid JSON to trigger update
  }
}

/**
 * Get guild-specific file
 * @param {String} guildID 
 * @param {String} file 
 */
function getGuildSpecific(guildID, file) {
  log(`writeGuildSpecific | ${guildID} | file: ${file}`);
  let filePath = path.join(__dirname, "..", "stores", guildID, file);
  let storedData = readFile(filePath);
  // merge defaults and stored settings to guarantee valid data - only for settings
  // if settings - merge defaults and stored
  // if calendar - send default if empty
  // otherwise return normal
  return (file === "settings.json") ? {...defaultSettings, ...storedData}
    : (file === "calendar.json" && !Object.entries(storedData).length) ? emptyCal
      : storedData;
}

/**
 * Generate daymap
 * @param {Object} settings - guildsettings to build around
 * @returns {dayMap} - dayMap for guild
 */
function generateDayMap(settings) {
  let dayMap = [];
  // allowing all days to be correctly TZ adjusted
  let d = DateTime.fromJSDate(new Date()).setZone(settings.timezone);
  // if Option to show past events is set, start at startOf Day instead of NOW()
  if (settings.showpast === "1") d = d.startOf("day");
  dayMap[0] =  d;
  for (let i = 1; i < settings.days; i++) {
    dayMap[i] = d.plus({ days: i }); //DateTime is immutable, this creates new objects!
  }
  return dayMap;
}

/**
 * @class
 */
function Guild(guildID) {
  // Load Settings
  let settings = getGuildSpecific(guildID, "settings.json"); 
  /**
   * Get specific or all settings
   * @param {String} [key] - Optional key to fetch 
   */
  this.getSetting = (key) => (key ? settings[key] : settings);
  /**
   * Sets specific setting to value
   * @param {String} key - key of setting to change
   * @param {String} value - value to set key to
   */
  this.setSetting = (key, value) => {
    settings[key] = value;
    writeGuildSpecific(guildID, settings, "settings");
  };
  // common properties
  this.prefix = settings.prefix;
  this.id = guildID;
  this.tz = settings.timezone;
  this.lng = settings.lng;
  // calendar
  let calendar = getGuildSpecific(guildID, "calendar.json");
  /**
   * Get calendar file
   * @param {String} [key] - Optionally get specific key 
   */
  this.getCalendar = (key) => (key ? calendar[key] : calendar);
  /**
   * Set Calendar to value
   * @param {Object} [argCalendar] - If provided, set to given calendar, else write current calendar
   */
  this.setCalendar = (argCalendar = calendar) => {
    writeGuildSpecific(guildID, argCalendar, "calendar");
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
  // generate daymap
  this.getDayMap = () => generateDayMap(settings);
  // get OAuth2 Token
  this.getToken = () => getGuildSpecific(guildID, "token.json");
  /**
   * Set OAuth2 token
   * @param {Object} token - token object to write
   */
  this.setToken = (token) => writeGuildSpecific(guildID, token, "token");
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
   * Update settings and calendar
   */
  this.update = () => {
    log(`Guild.update | ${guildID}`);
    settings = getGuildSpecific(guildID, "settings.json");
    calendar = getGuildSpecific(guildID, "calendar.json");
  };
}

module.exports = {
  Guild,
  createGuild,
  deleteGuild,
  recreateGuild
};