let discord = require("discord.js");
const { readdirSync } = require("fs");
const path = require("path");
const log = require("debug")("niles:bot");
let client = new discord.Client();
exports.discord = discord;
exports.client = client;
const settings = require("./settings.js");
const commands = require("./handlers/commands.js");
const guilds = require("./handlers/guilds.js");
const helpers = require("./handlers/helpers.js");

// static commands
let shardGuilds = [];
let shardID;

/**
 * Gets all known guilds
 * @returns {[String]} - Array of guildids
 */
function getKnownGuilds() {
  log("start getKnownGuilds");
  let fullPath = path.join(__dirname, "stores");
  return readdirSync(fullPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
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
    log(`creating new guild: ${guildID}`);
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
  "timers", "reset"
];

/**
 * command runner
 * @param {Snowflake} message - message to run command from
 */
function runCmd(message) {
  // load settings
  const guild = new guilds.Guild(message.guild.id);
  const guildSettings = guild.getSetting();
  // ignore messages without prefix or mention
  if (!message.content.toLowerCase().startsWith(guild.prefix) && !message.mentions.has(client.user.id)) return;
  // parse command and arguments
  let args = message.content.slice(guildSettings.prefix.length).trim().split(" ");
  // if mentioned return second object as command, if not - return first object as command
  let cmd = message.mentions.has(client.user.id) ? args.splice(0, 2)[1] : args.shift();
  args = args ? args : []; // return empty array if no args
  cmd = cmd.toLowerCase();
  // ignore non-whitelisted commands
  if (!validCmd.includes(cmd)) return;
  // check if user has restricted role
  if (!helpers.checkRole(message, guildSettings)) {
    return message.channel.send(`You must have the \`${guildSettings.allowedRoles[0]}\` role to use Niles in this server`)
      .then((message) => message.delete({ timeout: 10000 }));
  }
  helpers.log(`${message.author.tag}:${message.content} || guild:${message.guild.id} || shard:${client.shard.ids}`); // log message
  commands.run(cmd, args, message); // all checks passed - run command
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
      log(`guild cache error: ${err}`);
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
/**
 * handles exit
 * @param {String} msg - message prior to exit
 */
function handle(msg) {
  helpers.log(`Exiting - ${msg}`);
  client.destroy();
  process.exit();
}

process.on("SIGINT", handle);

process.on("uncaughtException", (err) => {
  helpers.log("uncaughtException error" + err);
  console.log(err.stack);
  handle("uncaughtException");
});

process.on("unhandledRejection", (err) => {
  helpers.log("Promise Rejection: " + err);
  if (err.code === "ECONNRESET") handle("ECONNRESET");
});
