let discord = require("discord.js");
let client = new discord.Client();
exports.discord = discord;
exports.client = client;
const path = require("path");
const users = require("./stores/users.json");
let settings = require("./settings.js");
let commands = require("./handlers/commands.js");
let guilds = require("./handlers/guilds.js");
let init = require("./handlers/init.js");
let helpers = require("./handlers/helpers.js");
let restricted = require("./handlers/nopermissions.js");
let dm = require("./handlers/dm.js");
let checks = require("./handlers/createMissingAttributes.js");

client.login(settings.secrets.bot_token);

client.on("ready", () => {
  helpers.log("Bot is logged in");
  client.user.setStatus("online");

  //Create databases for any missing guilds
  const availableGuilds = Array.from(client.guilds.keys());
  const knownGuilds = Object.keys(helpers.getGuildDatabase());
  const unknownGuilds = availableGuilds.filter(x => !knownGuilds.includes(x));

  unknownGuilds.forEach((guildId) => {
    helpers.log("unknown guild found; creating");
    guilds.create(client.guilds.get(guildId));
  });
});

client.on("guildCreate", (guild) => {
  guilds.create(guild);
});

client.on("guildDelete", (guild) => {
  guilds.delete(guild);
});

client.on("message", (message) => {
  if (message.author.bot) {
    return;
  }
  if (message.channel.type === "dm") {
    try {
      dm.run(message);
    } catch (err) {
      helpers.log("error in dm channel" + err);
    }
    return;
  }
  //only load guild settings after checking that message is not direct message.
  let guildSettingsPath = path.join(__dirname, "stores", message.guild.id, "settings.json");
  try {
    var guildSettings = helpers.readFile(guildSettingsPath);
  } catch (err) {
    return helpers.log(err);
  }
  //Check that there is a prefix - need more robust check of database files.
  try {
    (guildSettings.prefix);
  } catch (err) {
    guilds.create(message.guild);
    message.channel.send("Sorry, I've had to re-create your database files, you'll have to run the setup process again :(");
    return helpers.log("settings file not created properly ");
  }
  //Check if the database structure is up to date.
  try {
    if (checks.allowedRoles(message)) {
      return message.channel.send("Sorry, I just had to update your database files. Please try again.");
    }
  } catch (err) {
    return helpers.log(err);
  }
  //Ignore messages that dont use guild prefix or mentions.
  if (!message.content.toLowerCase().startsWith(guildSettings.prefix) && !message.isMentioned(client.user.id)) {
    return;
  }
  //Ignore if the command isn't one of the commands.
  const cmd = message.content.toLowerCase().substring(guildSettings.prefix.length).split(" ")[0];
  if (!restricted.allCommands.includes(cmd)) {
    return;
  } else {
    helpers.log(`${helpers.fullname(message.author)}:${message.content} || guild:${message.guild.id}`);
  }
  if (!helpers.checkPermissions(message) && (!users[message.author.id] || users[message.author.id].permissionChecker === "1" || !users[message.author.id].permissionChecker)) {
    if (restricted.allCommands.includes(cmd)) {
      if (!helpers.checkRole(message)) {
        return message.channel.send("You must have the `" + guildSettings.allowedRoles[0] + "` role to use Niles in this server")
      }
      try {
        restricted.run(message);
      } catch (err) {
        helpers.log("error in restricted permissions " + err);
      }
      return;
    }
  } else if (!helpers.checkPermissions(message)) {
    return;
  }
  if (!guildSettings.calendarID || !guildSettings.timezone) {
    try {
      if (!helpers.checkRole(message)) {
        return message.channel.send("You must have the `" + guildSettings.allowedRoles[0] + "` role to use Niles in this server")
      }
      init.run(message);
    } catch (err) {
      helpers.log("error running init messages in guild: " + message.guild.id + ": " + err);
      return message.channel.send("something went wrong");
    }
  } else {
    try {
      if (!helpers.checkRole(message)) {
        return message.channel.send("You must have the `" + guildSettings.allowedRoles[0] + "` role to use Niles in this server")
      }
      commands.run(message);
    } catch (err) {
      helpers.log("error running main message handler in guild: " + message.guild.id + ": " + err);
      return message.channel.send("something went wrong");
    }
  }
});

// ProcessListeners
process.on("uncaughtException", (err) => {
  helpers.log("uncaughtException error" + err);
});

process.on("SIGINT", () => {
  client.destroy();
  process.exit();
});

process.on("exit", () => {
  client.destroy();
  process.exit();
});

process.on("unhandledRejection", (err) => {
  helpers.log("unhandled promise rejection " + err);
});
