const fs = require("fs");
const path = require("path");
const helpers = require("./helpers.js");
const commands = require("./commands.js");

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

/**
 * Create new guild files
 * @param {Snowflake} guild - Guild to create files for
 */
function createGuild(guild) {
  let guildPath = path.join(__dirname, "..", "stores", guild.id);
  const guildData = {
    "guildid": guild.id,
    "name": guild.name,
    "region": guild.region,
    "ownerName": "",
    "ownerId": guild.ownerID,
    "timeAdded": new Date()
  };
  if (fs.existsSync(guildPath)) { // directory already exists
    helpers.log(`Guild ${guild.id} has come back online`);
  } else if (!fs.existsSync(guildPath)) { // create directory and new files
    fs.mkdirSync(guildPath); 
    helpers.writeGuildSpecific(guild.id, emptyCal, "calendar");
    helpers.writeGuildSpecific(guild.id, helpers.defaultSettings, "settings");
    helpers.amendGuildDatabase({ [guild.id]: guildData });
    helpers.log(`Guild ${guild.id} has been created`);
  }
}

/**
 * Delete guild settings
 * @param {Snowflake} guild - guild to delete configuration for
 */
function deleteGuild(guild) {
  let guildPath = path.join(__dirname, "..", "stores", guild.id);
  helpers.deleteFolderRecursive(guildPath);
  helpers.removeGuildFromDatabase(guild.id);
  commands.deleteUpdater(guild.id);
  helpers.log(`Guild ${guild.id} has been deleted`);
};

/**
 * Delete and recreate guild settings
 * @param {Snowflake} guild 
 */
function recreateGuild(guild) {
  deleteGuild(guild);
  createGuild(guild);
}

module.exports = {
  createGuild,
  deleteGuild,
  recreateGuild
};