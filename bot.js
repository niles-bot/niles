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

client.login(settings.secrets.bot_token);

client.on("ready", () => {
    console.log(new Date().toUTCString() + " : Bot is logged in");
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
        return;
    }
    let guildSettingsPath = path.join(__dirname, "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    if (!message.content.toLowerCase().startsWith(guildSettings.prefix) && !message.isMentioned(client.user.id)) {
        return;
    }
    if (!guildSettings.calendarID || !guildSettings.timezone) {
        try {
          init.run(message);
        }
        catch (err) {
          helpers.LogError(err);
          return message.channel.send("something went wrong");
        }
      }
      else {
          try {
            commands.run(message);
          }
          catch (err) {
            helpers.LogError(err);
            return message.channel.send("something went wrong");
          }
      }
    helpers.Log(`${helpers.fullname(message.author)} : ${message.content} in guild ${message.guild.id}`);
});

// ProcessListeners

process.on("uncaughtException", (err) => {
    helpers.LogError(err);
});

process.on("SIGINT", () => {
    client.destroy();
    process.exit();
});

process.on("exit", () => {
    client.destroy();
    process.exit();
});
