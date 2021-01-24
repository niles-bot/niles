let discord = require("discord.js");
let client = new discord.Client();
exports.discord = discord;
exports.client = client;
const settings = require("./settings.js");
const commands = require("./handlers/commands.js");
const guilds = require("./handlers/guilds.js");
const init = require("./handlers/init.js");
const helpers = require("./handlers/helpers.js");

/**
 * Add any missing guilds to guilds database
 * @param {*} availableGuilds 
 */
function addMissingGuilds(availableGuilds) {
  //Create databases for any missing guilds
  const knownGuilds = Object.keys(helpers.getGuildDatabase());
  const unknownGuilds = availableGuilds.filter((x) => !knownGuilds.includes(x));
  unknownGuilds.forEach((guildId) => {
    guilds.createGuild(client.guilds.cache.get(guildId));
  });
}

/**
 * Check if command is on whitelist
 * @param {Snowflake} message - message to check agianst
 * @param {String} prefix - prefix of guild
 */
function isValidCmd(message, prefix) {
  const validCmds = [
    // init
    "id", "tz", "setup", "help", "init", "prefix", "admin", "auth", 
    // calendar
    "display", "create", "scrim", "delete", "update",
    "sync", "next", "get", "stop",
    // display options
    "displayoptions", "channel", "calname", 
    // channel maintenance
    "clean", "purge", "validate", "count",
    // bot help
    "stats", "info", "invite", "ping", 
    // admin cmd
    "timers", "reset", 
  ];
  try {
    // repeated command parser
    const args = message.content.slice(prefix.length).trim().split(" ");
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
      });
      addMissingGuilds(shardGuilds); // start adding missing guilds
      helpers.log("all shards spawned"); // all shards spawned
      return null;
    })
    .catch((err) => {
      if (err.name === "Error [SHARDING_IN_PROCESS]") {
        console.log("spawning shards ..."); // send error to console - still sharding
      }
    });
});

client.on("guildCreate", (guild) => {
  guilds.createGuild(guild);
});

client.on("guildDelete", (guild) => {
  guilds.deleteGuild(guild);
});

client.on("message", (message) => {
  try {
    // ignore if dm or sent by bot
    if (message.channel.type === "dm" || message.author.bot) return;
    const guild = new helpers.Guild(message.guild.id);
    const guildSettings = guild.getSetting();
    //Ignore messages that dont use guild prefix or mentions.
    if (!message.content.toLowerCase().startsWith(guildSettings.prefix) && !message.mentions.has(client.user.id)) return;
    // ignore messages that do not have one of the whitelisted commands
    if (!isValidCmd(message, guild.prefix)) return;
    helpers.log(`${message.author.tag}:${message.content} || guild:${message.guild.id} || shard:${client.shard.ids}`);
    if (!helpers.checkRole(message)) { // if no permissions, warn
      return message.channel.send(`You must have the \`${guildSettings.allowedRoles[0]}\` role to use Niles in this server`);
    }
    if (!guildSettings.calendarID || !guildSettings.timezone) {
      try { init.run(message);
      } catch (err) {
        helpers.log(`error running init messages in guild: ${message.guild.id} : ${err}`);
        return message.channel.send("I'm having issues with this server - please try kicking me and re-inviting me!");
      }
    } else {
      commands.run(message);
    }
  } catch (err) {
    helpers.log(`error running main message handler in guild: ${message.guild.id} : ${err}`);
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

// exports
module.exports.isValidCmd = isValidCmd;
