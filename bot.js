const discord = require("discord.js");
const { readdirSync } = require("fs");
const { join } = require("path");
const debug = require("debug")("niles:bot");
const client = new discord.Client();
exports.client = client;
const TOKEN = require("./settings.js").secrets.bot_token;
const commands = require("./handlers/commands.js");
const guilds = require("./handlers/guilds.js");
const { checkRole, permissionCheck, log } = require("./handlers/helpers.js");
const { i18n } = require("./handlers/strings.js");

// bot properties
let shardGuilds = [];
let shardID;

client.on("nilesCalendarUpdate", (gid, cid) => {
  const channel = client.channels.cache.get(cid);
  if (channel) { // only run updater if channel is on shard
    debug(`nilesCalendarUpdate | gid ${gid} cid ${cid} | shard ${shardID}`);
    commands.workerUpdate(gid, channel);
  }
});

/**
 * Gets all known guilds
 * @returns {[String]} - Array of guildids
 */
function getKnownGuilds() {
  debug("start getKnownGuilds");
  let fullPath = join(__dirname, "stores");
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
    debug(`creating new guild: ${guildID}`);
    guilds.createGuild(guildID);
  });
}

// valid commands
const validCmd = [
  // init
  "id", "tz", "setup", "help", "locale",
  "init", "prefix", "admin", "auth", 
  // calendar
  "display", "create", "scrim", "delete",
  "update", "sync", "next", "get", "stop",
  // display options
  "displayoptions", "channel", "calname", 
  // channel maintenance
  "clean", "purge", "validate",
  // bot help
  "stats", "info", "invite", "ping", 
  // admin cmd
  "reset", "debug"
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
  if (!message.content.startsWith(guild.prefix) && !message.mentions.has(client.user.id)) return;
  // parse command and arguments
  let args = message.content.slice(guildSettings.prefix.length).trim().split(" ");
  // if mentioned return second object as command, if not - return first object as command
  let cmd = message.mentions.has(client.user.id) ? args.splice(0, 2)[1] : args.shift();
  args = args ? args : []; // return empty array if no args
  cmd = cmd.toLowerCase();
  // ignore non-whitelisted commands
  if (!validCmd.includes(cmd)) return;
  // check if user is allowed to interact with Niles
  if (!checkRole(message, guildSettings)) { // if no permissions, warn
    return message.channel.send(i18n.t("norole", { lng: guild.lng, allowedrole: guildSettings.allowedRoles[0] }))
      .then((message) => message.delete({ timeout: 10000 }));
  }
  // check missing permisions
  const missingPermissions = permissionCheck(message.channel);
  if (missingPermissions.includes("SEND_MESSAGES")) {
    message.author.send(`Hey I noticed you tried to use the command \`${cmd}\`. I am missing the following permissions in channel **${message.channel.name}**: \`\`\`${missingPermissions}\`\`\``);
  }
  log(`${message.author.tag}:${message.content} || guild:${message.guild.id} || shard:${client.shard.ids}`); // log message
  commands.run(cmd, args, message); // all checks passed - run command
}

client.login(TOKEN);

client.on("ready", () => {
  shardID = client.shard.ids;
  log(`Bot is logged in. Shard: ${shardID}`);
  // fetch all guild cache objects
  client.shard.fetchClientValues("guilds.cache")
    .then((results) => {
      results.forEach(function (item) { // iterate over shards
        item.forEach(function (item) { // iterate over servers
          shardGuilds.push(item.id); // add server id to shardGuilds
        });
      });
      addMissingGuilds(shardGuilds); // start adding missing guilds
      return log("all shards spawned"); // all shards spawned
    })
    .catch((err) => {
      debug(`guild cache error: ${err}`);
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
    log(`error running main message handler in guild: ${message.guild.id} : ${err}`);
  }
});

// ProcessListeners
/**
 * handles exit
 * @param {String} msg - message prior to exit
 */
function handle(msg) {
  log(msg);
  client.destroy();
  process.exit();
}

process.on("SIGINT", handle);

process.on("uncaughtException", (err) => {
  console.error(err.stack);
  handle("uncaughtException error" + err);
});

process.on("unhandledRejection", (err) => {
  log("Promise Rejection: " + err);
  if (err.code === "ECONNRESET") handle("ECONNRESET");
});
