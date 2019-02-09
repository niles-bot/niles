const fs = require("fs");
const path = require("path");
const settings = require("../settings.js");
const helpers = require("./helpers.js");
const commands = require("./commands.js");
const bot = require("../bot.js");

exports.create = (guild) => {
  let guildPath = path.join(__dirname, "..", "stores", guild.id);
  let d = new Date();
  if (!fs.existsSync(guildPath)) {
    fs.mkdirSync(guildPath);
  }
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
  let defaultSettings = {
    "prefix": "!",
    "calendarID": "",
    "calendarChannel": "",
    "timezone": "",
    "helpmenu": "1",
    "allowedRoles": []
  };
  const guildData = {
    "guildid": guild.id,
    "name": guild.name,
    "region": guild.region,
    "ownerName": guild.owner.displayName,
    "ownerId": guild.ownerID,
    "timeAdded": d
  };
  helpers.writeGuildSpecific(guild.id, emptyCal, "calendar");
  helpers.writeGuildSpecific(guild.id, defaultSettings, "settings");
  helpers.amendGuildDatabase({ [guild.id]: guildData });
  helpers.log(`Guild ${guild.id} has been created`);
  //guild.defaultChannel.send("Hi, I'm **" + bot.client.user.username + "**, I can help you sync Google Calendars with Discord! Try ``!setup`` for details on how to get started.  **NOTE**: Make sure I have the right permissions in the channel you try and use me in!");
};

exports.delete = (guild) => {
  let guildPath = path.join(__dirname, "..", "stores", guild.id);
  helpers.deleteFolderRecursive(guildPath);
  helpers.removeGuildFromDatabase(guild.id);
  commands.deleteUpdater(guild.id);
  helpers.log(`Guild ${guild.id} has been deleted`);
};
