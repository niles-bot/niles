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

client.login(settings.secrets.bot_token);

client.on("ready", () => {
    helpers.log("Bot is logged in");
    client.user.setStatus("online");
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
    let guildSettings = helpers.readFile(guildSettingsPath);
    if (!message.content.toLowerCase().startsWith(guildSettings.prefix) && !message.isMentioned(client.user.id)) {
        return;
    }
    helpers.log(`${helpers.fullname(message.author)}:${message.content} || guild:${message.guild.id}`);
    if(!helpers.checkPermissions(message) && (!users[message.author.id] || users[message.author.id]["permissionChecker"] === "1" || !users[message.author.id]["permissionChecker"])) {
        try {
            restricted.run(message);
          } catch (err) {
              helpers.log("error in restricted permissions " + err);
          }
        return;
    } else if (!helpers.checkPermissions(message)) {
        return;
    }
    if (!guildSettings.calendarID || !guildSettings.timezone) {
        try {
          init.run(message);
        }
        catch (err) {
          helpers.log("error running init messages in guild: " + message.guild.id + ": " + err);
          return message.channel.send("something went wrong");
        }
      }
      else {
          try {
            commands.run(message);
          }
          catch (err) {
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
