const discord = require("discord.js");
const { readdirSync } = require("fs");
const { join } = require("path");
const debug = require("debug")("niles:bot");
const client = new discord.Client();
exports.client = client;
const TOKEN = require("~/settings.js").secrets.bot_token;
const { workerUpdate } = require("~/handlers/workerUpdate.js");
const guilds = require("~/handlers/guilds.js");
const { checkRole, permissionCheck, log } = require("~/handlers/helpers.js");
const { i18n } = require("~/handlers/strings.js");

// bot properties
let shardID;

// functions
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

/**
 * Check validity of commands and return command name and parameters
 * @param {Snowflake} message 
 * @returns {[String]} Array of arguments
 */
function commandParser(message) {
  // skip bot or DM
  if (message.channel.type === "dm" || message.author.bot) return;
  // fetch prefix
  const guild = new guilds.Guild(message.guild.id);
  // ignore messages without prefix or mention
  if (!message.content.startsWith(guild.prefix) && !message.mentions.has(client.user.id)) return;
  // parse command and arguments
  let args = message.content.slice(guild.prefix.length).trim().split(" ");
  // if mentioned return shift once to remove mention
  if (message.mentions.has(client.user.id)) args.shift();
  // return false if no args
  return args ? args : false; // return empty array if no args
}

// command setup
client.commands = new discord.Collection();
const commandFiles = readdirSync("./commands").filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  // set a new item in the Collection
  // with the key as the command name and the value as the exported module
  client.commands.set(command.name, command);
}

// client listeners
client.login(TOKEN);

client.on("ready", () => {
  shardID = client.shard.ids;
  log(`Bot is logged in. Shard: ${shardID}`);
  let shardGuilds = [];
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

client.on("guildCreate", (guild) => guilds.createGuild(guild.id));
client.on("guildDelete", (guild) => guilds.deleteGuild(guild.id));

client.on("nilesCalendarUpdate", (gid, cid) => {
  const channel = client.channels.cache.get(cid);
  if (channel) { // only run updater if channel is on shard
    debug(`nilesCalendarUpdate | gid ${gid} cid ${cid} | shard ${shardID}`);
    workerUpdate(gid, channel);
  }
});

client.on("message", (message) => {
  // fetch prefix
  const guild = new guilds.Guild(message.guild.id);
  const guildSettings = guild.getSetting();
  // extract command from command parser
  let args = commandParser(message);
  // if no args return
  if (!args) return;
  const cmd = args.shift().toLowerCase;
  args = args ? args : []; // return empty array if no args

  // check if user has needed roles
  if (!checkRole(message, guildSettings)) { // if no permissions, warn
    return message.channel.send(i18n.t("norole", { lng: guild.lng, allowedrole: guildSettings.allowedRoles[0] }))
      .then((message) => message.delete({ timeout: 10000 }));
  }

  // check for any missing permissions
  const missingPermissions = permissionCheck(message.channel);
  if (missingPermissions.includes("SEND_MESSAGES")) {
    return message.author.send(`Hey I noticed you tried to use the command \`${cmd}\`. I am missing the following permissions in channel **${message.channel.name}**: \`\`\`${missingPermissions}\`\`\``);
  }
  
  log(`${message.author.tag}:${message.content} || guild:${message.guild.id} || shard:${client.shard.ids}`); // log message

  // run command
  const command = client.commands.get(cmd)
		|| client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(cmd));

  // command not found
  if (!command) return;
  // setup only
  if (!command.preSetup && !guildSettings.calendarID && !guildSettings.timezone)
    return message.channel.send(i18n.t("setup.error", {lng: guildSettings.lng}));
  // args required
  if (command.args && !args.length) {
    let reply = `You didn't provide any arguments, ${message.author}!`;
    if (command.usage) {
      reply += `\nThe proper usage would be: \`${guild.prefix}${command.name} ${command.usage}\``;
    }
    return message.channel.send(reply);
  }
  try {
    command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.channel.send("there was an error trying to execute that command!");
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
