const fs = require("fs");
const path = require("path");
const commands = require("./commands.js");
const helpers = require("./helpers.js");
const guilds = require("./guilds.js");
const defer = require("promise-defer");

const HELP_MESSAGE = "```\
        Niles Usage - SETUP MODE\n\
---------------------------\n\
NOTE: ALL COMMANDS BECOME AVAILABLE AFTER SETUP IS COMPLETE\n\
!setup               -  Get details on how to setup Niles for use.\n\
!prefix              -  View or change the prefix for Niles\n\
!id                  -  Set the Google calendar ID for the guild\n\
!tz                  -  Set the timezone for the guild\n\
!help                -  Display this message\n\
```\n\
Visit http://niles.seanecoffey.com/setup for more info.";

const SETUP_MESSAGE = "\
Hi! Lets get me setup for use in this Discord. The steps are outlined below, but for a detailed setup guide, visit http://niles.seanecoffey.com/setup \n\
\n1. Invite `niles-291@niles-169605.iam.gserviceaccount.com` to \'Make changes to events\' under the Permission Settings on the Google Calendar you want to use with Niles\n\
2. Enter the Calendar ID of the calendar to Discord using the `!id` command, i.e. `!id 123abc@123abc.com`\n\
3. Enter the timezone you want to use in Discord with the `!tz` command, i.e. `!tz gmt+10:00`, (Note: Must be formatted like this)\n\
\n Niles should now be able to sync with your Google calendar and interact with on you on Discord, try `!display` to get started!";

//functions

function writeSetting(message, value, setting) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    guildSettings[setting] = value;
    message.channel.send("Okay I'm adding your " + setting + " as `" + value + "`");
    helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
}

function logId(message) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    let calendarId = message.content.split(" ")[1];
    if(!calendarId && !guildSettings["calendarID"]) {
        message.channel.send("Enter a calendar ID using `!id`, i.e. `!id 123abc@123abc.com`");
        return;
    }
    if (!calendarId) {
        message.channel.send("You didn't enter a calendar ID, you are currently using `" +  guildSettings["calendarID"] + "`");
        return;
    }
    if (message.content.indexOf("@") === -1) {
        message.channel.send("I don\'t think that\'s a valid calendar ID.. try again");
        return;
    }
    if(guildSettings["calendarID"] !== "") {
        message.channel.send("I've already been setup to use ``" + guildSettings["calendarID"] + "`` as the calendar ID in this server, do you want to overwrite this and set the ID to `" + calendarId + "`? **(y/n)**");
        helpers.yesThenCollector(message).then(() => {
            writeSetting(message, calendarId, "calendarID");
        }).catch((err) => {
            helpers.log(err);
        });
    }
    else {
      writeSetting(message, calendarId, "calendarID");
    }
}

function logTz(message) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    let tz = message.content.split(" ")[1];
    if(!tz && !guildSettings["timezone"]) {
        message.channel.send("Enter a timezone using `!tz`, i.e. `!tz GMT+10:00` (Must be formatted like this.)");
        return;
    }
    if(!tz) {
        message.channel.send("You didn't enter a timezone, you are currently using `" + guildSettings["timezone"] + "`");
        return;
    }
    tz = tz.toUpperCase();
    if(tz.indexOf("GMT") === -1 || (tz.indexOf("+") === -1 && tz.indexOf("-")) === -1 || tz.length !== 9 ) {
        message.channel.send("Please enter timezone in valid format, i.e. ``GMT+06:00`` (must be formatted like this)");
        return;
    }
    if(guildSettings["timezone"] !== "") {
        message.channel.send("I've already been setup to use `" + guildSettings["timezone"] + "`, do you want to overwrite this and use `" + tz + "`? **(y/n)** ");
        helpers.yesThenCollector(message).then(() => {
            writeSetting(message, tz, "timezone");
        }).catch((err) => {
            helpers.log(err);
        });
    }
    else {
        writeSetting(message, tz, "timezone");
    }
}

function setPrefix(message) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    let newPrefix = message.content.split(" ")[1];
    if(!newPrefix) {
        return message.channel.send(`You are currently using \`${guildSettings.prefix}\` as the prefix. To change the prefix use \`!prefix <newprefix>\` or \`@Niles prefix <newprefix>\``);
    }
    if(newPrefix) {
        message.channel.send(`Do you want to set the prefix to \`${newPrefix}\` ? **(y/n)**`);
        helpers.yesThenCollector(message).then(() => {
          writeSetting(message, newPrefix, "prefix");
        }).catch((err) => {
            helpers.log(err);
        });
    }
}

exports.run = function(message) {
  if (!helpers.checkPermissions(message)) {
    return helpers.log("no permission to send messages.");
  }
  let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
  let guildSettings = helpers.readFile(guildSettingsPath);
  const cmd = message.content.toLowerCase().substring(guildSettings.prefix.length).split(" ")[0];

  // Function Mapping
  let setup = () => message.channel.send(SETUP_MESSAGE);
  let id = () => logId(message);
  let tz = () => logTz(message);
  let init = () => guilds.create(message.guild);
  let prefix = () => setPrefix(message);
  let restricted = () => message.channel.send("You haven't finished setting up! Try `!setup` for details on how to start.");
  let help = () => message.channel.send(HELP_MESSAGE);

  let cmdFns = {
      setup,
      id,
      tz,
      init,
      prefix,
      help,
      "start": setup,
      "display": restricted,
      "clean": restricted,
      "update": restricted,
      "sync": restricted,
      "invite": restricted,
      "stats": restricted,
      "create": restricted,
      "scrim": restricted,
      "delete": restricted,
      "info": restricted
  };

  let cmdFn = cmdFns[cmd];
  if (cmdFn) {
      cmdFn();
  }
};
