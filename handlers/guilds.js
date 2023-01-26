const fs = require("fs");
const { join } = require("path");
const { DateTime } = require("luxon");
const { oauth2, sa } = require("../settings.js");
const log = require("debug")("niles:guilds");

const emptyCal = {
  "events": {
    "day0": [],
    "day1": [],
    "day2": [],
    "day3": [],
    "day4": [],
    "day5": [],
    "day6": []
  },
  "lastUpdate": "",
  "calendarMessageId": ""
};

// default guild settings
const defaultSettings = {
  "version": 1,
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
  "startonly": "0",
  "eventtime": "1",
  "lng": "en",
  "lasterr": "",
  "timestamp": "0",
  "calurl": "1"
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
  log(`writeGuildSpecific | ${guildID} | file: ${file}`);
  const basePath = process.env.STORE_PATH ?? join(__dirname, "..", "stores");
  let fullPath = join(basePath, guildID, file + ".json");
  fs.writeFile(fullPath, JSON.stringify(json, "", "\t"), (err) => {
    if (err) return log("error writing guild specific database: " + err);
  });
}

/**
 * Create new guild files
 * @param {String} guildID - Guild to create files for
 */
function createGuild(guildID) {
  const basePath = process.env.STORE_PATH ?? join(__dirname, "..", "stores");
  const guildPath = join(basePath, guildID);
  if (!fs.existsSync(guildPath)) { // create directory and new files
    fs.mkdirSync(guildPath); 
    writeGuildSpecific(guildID, emptyCal, "calendar");
    writeGuildSpecific(guildID, defaultSettings, "settings");
    log(`Guild ${guildID} has been created`);
  }
}

/**
 * Delete guild settings
 * @param {String} guildID - guild to delete configuration for
 */
function deleteGuild(guildID) {
  const basePath = process.env.STORE_PATH ?? join(__dirname, "..", "stores");
  const guildPath = join(basePath, guildID);
  deleteFolderRecursive(guildPath);
  log(`Guild ${guildID} has been deleted`);
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
    log("error reading file " + err);
    return {}; // return valid JSON to trigger update
  }
}

/**
 * Get guild-specific file
 * @param {String} guildID 
 * @param {String} file 
 */
function getGuildSpecific(guildID, file) {
  log(`getGuildSpecific | ${guildID} | file: ${file}`);
  const basePath = process.env.STORE_PATH ?? join(__dirname, "..", "stores");
  let filePath = join(basePath, guildID, file);
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
  this.settings = getGuildSpecific(guildID, "settings.json"); 
  /**
   * Get specific or all settings
   * @param {String} [key] - Optional key to fetch 
   */
  this.getSetting = (key) => (key ? this.settings[key] : this.settings);
  /**
   * Sets specific setting to value
   * @param {String} key - key of setting to change
   * @param {String} value - value to set key to
   */
  this.setSetting = (key, value) => {
    this.settings[key] = value;
    writeGuildSpecific(guildID, this.settings, "settings");
  };
  // common properties
  this.prefix = this.settings.prefix;
  this.id = guildID;
  this.tz = this.settings.timezone;
  this.lng = this.settings.lng;
  // calendar
  this.calendar = getGuildSpecific(guildID, "calendar.json");
  /**
   * Get calendar file
   * @param {String} [key] - Optionally get specific key 
   */
  this.getCalendar = (key) => this.calendar[key];
  // Write current calendar file
  this.writeCalendar = () => writeGuildSpecific(guildID, this.calendar, "calendar");
  /**
   * Set calendar last update
   * @param {String} date 
   */
  this.setCalendarLastUpdate = (date) => {
    this.calendar.lastUpdate = date;
    this.writeCalendar();
  };
  /**
   * Set Calendar day to value
   * @param {Integer} day - Key to change
   * @param {[Object]} events - events to set 
   */
  this.setEvents = (events) => {
    this.calendar["events"] = events;
    this.writeCalendar();
  };
  // calendarID
  /**
   * Set Calendar Message ID
   * @param {String} calendarID - ID of calendar message 
   */
  this.setCalendarID = (calendarID) => {
    this.calendar.calendarMessageId = calendarID;
    this.writeCalendar();
  };
  // generate daymap
  this.getDayMap = () => {
    const settings = getGuildSpecific(guildID, "settings.json");
    this.settings = settings;
    return generateDayMap(settings);
  };
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
    if (this.settings.auth === "oauth") {
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
    this.settings = getGuildSpecific(guildID, "settings.json");
    this.calendar = getGuildSpecific(guildID, "calendar.json");
  };
  this.setLastErr = (err) => this.setSetting("lasterr", err);
  this.getLastErr = () => this.getSetting("lasterr");
}

module.exports = {
  Guild,
  createGuild,
  deleteGuild,
  recreateGuild
};
