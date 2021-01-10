let discord = require("discord.js");
let client = new discord.Client();
exports.discord = discord;
exports.client = client;
const path = require("path");
let settings = require("./settings.js");
let commands = require("./handlers/commands.js");
let guilds = require("./handlers/guilds.js");
let init = require("./handlers/init.js");
let helpers = require("./handlers/helpers.js");
let checks = require("./handlers/createMissingAttributes.js");

function addMissingGuilds(availableGuilds) {
  //Create databases for any missing guilds
  const knownGuilds = Object.keys(helpers.getGuildDatabase());
  const unknownGuilds = availableGuilds.filter((x) => !knownGuilds.includes(x));
  unknownGuilds.forEach((guildId) => {
    helpers.log("unknown guild found; creating");
    guilds.create(client.guilds.cache.get(guildId));
  });
}

function isValidCmd(message) {
  const validCmds = ["help", "clean", "purge", "init", "update",
    "sync", "display", "create", "scrim", "delete",
    "stats", "info", "id", "tz", "invite",
    "prefix", "admin", "setup", "shard", "count",
    "ping", "displayoptions", "timers", "reset", "next",
    "validate", "calname"
  ];
  try {
    // repeated command parser
    let guildSettings = helpers.getGuildSettings(message.guild.id, "settings");
    const args = message.content.slice(guildSettings.prefix.length).trim().split(' ');
    // if mentioned return second object as command, if not - return first object as command
    let cmd = (message.mentions.has(client.user.id) ? args.splice(0, 2)[1] : args.shift());
    cmd = cmd.toLowerCase();
    return validCmds.includes(cmd);
  } catch (err) { // catch out of bounds for smaller messages
    return false;
  }
}

client.login(settings.secrets.bot_token);

client.on("ready", () => {
  helpers.log(`Bot is logged in. Shard: ${client.shard.ids}`);
  client.user.setStatus("online");
  // fetch all guild cache objects
  client.shard.fetchClientValues("guilds.cache")
      .then((results) => {
        const shardGuilds = [];
        results.forEach(function (item) { // iterate over shards
          item.forEach(function (item) { // iterate over servers
            shardGuilds.push(item.id); // add server id to shardGuilds
          });
        })
        addMissingGuilds(shardGuilds); // start adding missing guilds
        helpers.log("all shards spawned"); // all shards spawned
      })
      .catch((err) => {
        if (err.name === "Error [SHARDING_IN_PROCESS]") {
          console.log("spawning shards ..."); // send error to console - still sharding
        }
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
  let guildSettingsPath = path.join(__dirname, "stores", message.guild.id, "settings.json");
  try {
    var guildSettings = helpers.readFile(guildSettingsPath);
  } catch (err) {
    return helpers.log(err);
  }
  //Ignore messages that dont use guild prefix or mentions.
  if (!message.content.toLowerCase().startsWith(guildSettings.prefix) && !message.mentions.has(client.user.id)) {
    return;
  }
  // ignore messages that do not have one of the whitelisted commands
  if (!isValidCmd(message)) { 
    return;
  }
  helpers.log(`${message.author.tag}:${message.content} || guild:${message.guild.id} || shard:${client.shard.ids}`);
  if (!guildSettings.calendarID || !guildSettings.timezone) {
    try {
      if (!helpers.checkRole(message)) {
        return message.channel.send(`You must have the \`${guildSettings.allowedRoles[0]}\` role to use Niles in this server`);
      }
      init.run(message);
    } catch (err) {
      helpers.log(`error running init messages in guild: ${message.guild.id} : ${err}`);
      return message.channel.send("I'm having issues with this server - please try kicking me and re-inviting me!");
    }
  } else {
    try {
      if (!helpers.checkRole(message)) {
        return message.channel.send(`You must have the \`${guildSettings.allowedRoles[0]}\` role to use Niles in this server`)
      }
      commands.run(message);
    } catch (err) {
      return helpers.log(`error running main message handler in guild: ${message.guild.id} : ${err}`);
    }
  }
});

// ProcessListeners
process.on("uncaughtException", (err) => {
  helpers.log("uncaughtException error" + err);
  process.exit();
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
  helpers.log("Promise Rejection: " + err);
  // watch for ECONNRESET
  if (err.code === "ECONNRESET") {
    helpers.log("Connection Lost, Signalling restart");
    process.exit();
  }
});
