const fs = require("fs");
let commands = require("./commands.js");
let settings = require("../settings.js");
let guilddatabase = require("../stores/guilddatabase.json");
let helpers = require("./helpers.js");

exports.create = (guild) => {
      let guildPath = __dirname + `/../stores/${guild.id}`;
      let d = new Date();
      if(!fs.existsSync(guildPath)) {
          fs.mkdirSync(guildPath);
      }
      let empty = {};
      let defaultSettings = {
          'prefix': '!',
          'calendarID': '',
          'calendarChannel': '',
          'timezone': '',
          'helpmenu': '1'
          };
      guilddatabase[guild.id] = {
          'guildid': guild.id,
          'name': guild.name,
          'region': guild.region,
          'ownerName': guild.owner.displayName,
          'ownerId': guild.ownerID,
          'timeAdded': d
      };
      helpers.writeGuildSpecific(guild.id, empty, "calendar");
      helpers.writeGuildSpecific(guild.id, defaultSettings, "settings");
      helpers.writeGuilddb(guilddatabase);
      console.log(`Guild ${guild.id} has been created`);
  }

  exports.delete = (guild) => {
      let guildPath = __dirname + `/../stores/${guild.id}`;
      helpers.deleteFolderRecursive(guildPath);
      delete guilddatabase[guild.id];
      helpers.writeGuilddb(guilddatabase);
      console.log(`Guild ${guild.id} has been deleted`);
  }
