const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
const { oauth2, sa } = require("../settings.js");
const helpers = require("./helpers.js");

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
  "startonly": "0",
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
 * @param {String} guildid - ID of guild to write setting to 
 * @param {Object} json - json array of values to write
 * @param {String} file - file name to write to - calendar/settings 
 */
function writeGuildSpecific(guildid, json, file) {
  let fullPath = path.join(__dirname, "..", "stores", guildid, file + ".json");
  fs.writeFile(fullPath, JSON.stringify(json, "", "\t"), (err) => {
    if (err) return helpers.log("error writing guild specific database: " + err);
  });
}

/**
 * Create new guild files
 * @param {Snowflake} guild - Guild to create files for
 */
function createGuild(guild) {
  const guildPath = path.join(__dirname, "..", "stores", guild.id);
  if (!fs.existsSync(guildPath)) { // create directory and new files
    fs.mkdirSync(guildPath); 
    writeGuildSpecific(guild.id, emptyCal, "calendar");
    writeGuildSpecific(guild.id, helpers.defaultSettings, "settings");
    helpers.log(`Guild ${guild.id} has been created`);
  }
}

/**
 * Delete guild settings
 * @param {Snowflake} guild - guild to delete configuration for
 */
function deleteGuild(guild) {
  const guildPath = path.join(__dirname, "..", "stores", guild.id);
  deleteFolderRecursive(guildPath);
  helpers.log(`Guild ${guild.id} has been deleted`);
}

/**
 * Delete and recreate guild settings
 * @param {Snowflake} guild 
 */
function recreateGuild(guild) {
  deleteGuild(guild);
  createGuild(guild);
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
  this.tz = settings.timezone;
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
    let d = DateTime.fromJSDate(new Date()).setZone(this.tz);
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
}

module.exports = {
  Guild,
  createGuild,
  deleteGuild,
  recreateGuild
};