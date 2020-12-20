const fs = require("fs");
const path = require("path");
const settings = require("../settings.js");
const helpers = require("./helpers.js");
const commands = require("./commands.js");
const bot = require("../bot.js");

exports.emptyCal = {
  "lastUpdate": "",
  "calendarMessageId": ""
}

exports.create = (guild) => {
  let guildPath = path.join(__dirname, "..", "stores", guild.id);
  let emptyCal = {
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
};

exports.delete = (guild) => {
  let guildPath = path.join(__dirname, "..", "stores", guild.id);
  helpers.deleteFolderRecursive(guildPath);
  helpers.removeGuildFromDatabase(guild.id);
  commands.deleteUpdater(guild.id);
  helpers.log(`Guild ${guild.id} has been deleted`);
};
