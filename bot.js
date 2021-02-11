let discord = require("discord.js");
const { readdirSync } = require("fs");
const path = require("path");
let client = new discord.Client();
exports.discord = discord;
exports.client = client;
const settings = require("./settings.js");
const commands = require("./handlers/commands.js");
const guilds = require("./handlers/guilds.js");
const helpers = require("./handlers/helpers.js");

// bot properties
let shardGuilds = [];
let shardID;

/**
 * Gets all known guilds
 * @returns {[String]} - Array of guildids
 */
function getKnownGuilds() {
  let fullPath = path.join(__dirname, "stores");
  return readdirSync(fullPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

/**
 * Add any missing guilds to guilds database
 * @param {[String]} availableGuilds - array of available guilds
 */
function addMissingGuilds(availableGuilds) {
  //Create databases for any missing guilds
  const knownGuilds = getKnownGuilds();
  const unknownGuilds = availableGuilds.filter((x) => !knownGuilds.includes(x));
  unknownGuilds.forEach((guildID) => {
    guilds.createGuild(guildID);
  });
}

// valid commands
const validCmd = [
  // init
  "id", "tz", "setup", "help",
  "init", "prefix", "admin", "auth", 
  // calendar
  "display", "create", "scrim", "delete",
  "update", "sync", "next", "get", "stop",
  // display options
  "displayoptions", "channel", "calname", 
  // channel maintenance
  "clean", "purge", "validate", "count",
  // bot help
  "stats", "info", "invite", "ping", 
  // admin cmd
  "timers", "reset", 
];

function runCmd(message) {
  // load settings
  const guild = new guilds.Guild(message.guild.id);
  const guildSettings = guild.getSetting();
  //Ignore messages that dont use guild prefix or mentions.
  if (!message.content.toLowerCase().startsWith(guild.prefix) && !message.mentions.has(client.user.id)) return;
  // command parser
  // parse command and arguments
  let args = message.content.slice(guildSettings.prefix.length).trim().split(" ");
  // if mentioned return second object as command, if not - return first object as command
  let cmd = (message.mentions.has(client.user.id) ? args.splice(0, 2)[1] : args.shift());
  args = (args ? args : []); // return empty array if no args
  cmd = cmd.toLowerCase();
  // ignore messages that do not have one of the whitelisted commands
  if (!validCmd.includes(cmd)) return;
  // check if user is allowed to interact with Niles
  if (!helpers.checkRole(message)) { // if no permissions, warn
    return message.channel.send(`You must have the \`${guildSettings.allowedRoles[0]}\` role to use Niles in this server`)
      .then((message) => message.delete({ timeout: 10000 }));
  }
  // all checks passsed - log command
  helpers.log(`${message.author.tag}:${message.content} || guild:${message.guild.id} || shard:${client.shard.ids}`); // log message
  // all checks passed - run command
  commands.run(cmd, args, message);
}

client.login(settings.secrets.bot_token);

client.on("ready", () => {
  shardID = client.shard.ids;
  helpers.log(`Bot is logged in. Shard: ${shardID}`);
  // fetch all guild cache objects
  client.shard.fetchClientValues("guilds.cache")
    .then((results) => {
      results.forEach(function (item) { // iterate over shards
        item.forEach(function (item) { // iterate over servers
          shardGuilds.push(item.id); // add server id to shardGuilds
        });
      });
      addMissingGuilds(shardGuilds); // start adding missing guilds
      return helpers.log("all shards spawned"); // all shards spawned
    })
    .catch((err) => {
      if (err.name === "Error [SHARDING_IN_PROCESS]") {
        console.log("spawning shards ..."); // send error to console - still sharding
      }
    });
});

client.on("guildCreate", (guild) => {
  guilds.createGuild(guild.id);
});

client.on("guildDelete", (guild) => {
  guilds.deleteGuild(guild.id);
});

client.on("message", (message) => {
  try {
    if (message.channel.type === "dm" || message.author.bot) return; // ignore if dm or sent by bot
    runCmd(message); // run command through parser
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
