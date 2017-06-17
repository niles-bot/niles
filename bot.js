discord = require("discord.js");
client = new discord.Client();

const path = require('path');

let settings = require("./settings.js");
let commands = require("./handlers/commands.js");
let guilds = require("./handlers/guilds.js");
let init = require("./handlers/init.js");
let helpers = require("./handlers/helpers.js");

client.login(settings.secrets.bot_token);

client.on("ready", () => {
    console.log(new Date().toUTCString() + ' : Bot is logged in');
    client.user.setStatus("online");
})

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
    if (message.channel.type == "dm") {
        return;
    }
    let guildSettingsPath = path.join(__dirname, "stores", message.guild.id, "settings.json");
    let guildSettings = require(guildSettingsPath);
    if (!message.content.toLowerCase().startsWith(guildSettings.prefix) && !message.isMentioned(client.user.id)) {
        return;
    }
    else {
        if (!guildSettings.calendarID || !guildSettings.timezone) {
            try {
                init.run(message);
            }
            catch (err) {
                console.log(err);
                return message.channel.send("something went wrong");
            }
        }
        else {
            try {
                commands.run(message);
              }
              catch (err) {
                console.log(err);
                return message.channel.send("something went wrong");
              }
        }
    }
    console.log(new Date().toUTCString() + ` : ${helpers.fullname(message.author)} : ${message.content} in guild ${message.guild.id}`);
});

// ProcessListeners

process.on('uncaughtException', err => {
    console.log(err);
});

process.on("SIGINT", () => {
    client.destroy();
    process.exit();
});

process.on("exit", () => {
    client.destroy();
    process.exit();
});
