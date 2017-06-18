const fs = require("fs");
const path = require("path");
const commands = require("./commands.js");
const helpers = require("./helpers.js");
const guilds = require("./guilds.js");


const HELP_MESSAGE = "```\
        Niles Usage\n\
---------------------------\n\
NOTE - THE FULL LIST OF COMMANDS WILL NOT FUNCTION UNTIL GOOGLE CALENDAR ID IS ENTERED\n\
!display             -  Displays the calendar (chat prompts), without deleting any messages\n\
!init                -  Deletes all messages and displays the calendar\n\
!clean / !purge      -  Deletes all the messages in current channel\n\
!update / !sync      -  Sync Google calendar events with backend database\n\
!create / !scrim     -  Create events using GCal's default interpreter - works best like ``!scrim xeno June 5 8pm - 9pm``\n\
!delete              -  Delete an event using the form ``!delete Friday 8pm``, only works in this form i.e. ONE day and START time\n\
!stats / !info       -  Display list of statistics and information about the Niles bot\n\
!invite              -  Get the invite link for Niles to join your server!\n\
!help                -  Display this message\n\
```\n\
Visit http://niles.seanecoffey.com/setup for more info.";

const SETUP_MESSAGE = "\
Hi! Lets get me setup for use in this Discord. The steps are outlined below, but for a detailed setup guide, visit http://niles.seanecoffey.com/setup \n\
\n1. Invite `niles-291@niles-169605.iam.gserviceaccount.com` to \'manage events\' on the Google Calendar you want to use with Niles\n\
2. Enter the Calendar ID of the calendar to Discord using the `!id` command, i.e. `!id qb9t3fb6mn9p52a4re0hc067d8@group.calendar.google.com`\n\
3. Enter the timezone you want to use in Discord with the `!tz` command, i.e. `!tz gmt+10:00`, (Note: Must be formatted like this)\n\
\n Niles should now be able to sync with your Google calendar and interact with on you on Discord, try `!display` to get started!";

exports.run = function(message) {
  const cmd = message.content.toLowerCase().substring(1).split(" ")[0];
  if (cmd === "help" || helpers.mentioned(message, "help")) {
      message.author.send(HELP_MESSAGE);
      message.channel.fetchMessage(message.id).then((m) => {
          m.delete(1000);
      }).catch((e) => helpers.LogError(e));
  }

  if(["setup", "start"].includes(cmd) || helpers.mentioned(message, ["setup", "start"])) {
      message.channel.send(SETUP_MESSAGE);
  }

  if(cmd === "id" || helpers.mentioned(message, "id")) {
      logId(message);
  }

  if (cmd === "tz" || helpers.mentioned(message, "tz")) {
      logTz(message);
  }

  if (cmd === "init" || helpers.mentioned(message, "init")) {
      guilds.create(message.guild);
  }

  if (["display", "clean", "update", "sync", "invite", "stats", "create", "scrim", "delete"].includes(cmd)) {
      message.channel.send("You haven't finished setting up! Try `!setup` for details on how to start.");
  }
};

//functions

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
        const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, {time: 30000});
        collector.on("collect", (m) => {
            if(m.content.toLowerCase() === "y" || m.content.toLowerCase() === "yes") {
                guildSettings["calendarID"] = calendarId;
                message.channel.send("Okay, I'm adding your calendar ID as ``" + calendarId + "``");
                helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
            }
            else {
                message.channel.send("Okay I won't do that");
            }
            return collector.stop();
        });
      collector.on("end", (collected, reason) => {
          if(reason === "time") {
              message.channel.send("Command response timeout");
          }
      });
    }
    else {
      guildSettings["calendarID"] = calendarId;
      message.channel.send("Okay I'm adding your calendar ID as `" + calendarId + "`");
      helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
    }
}

function logTz(message) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    let tz = message.content.split(" ")[1].toUpperCase();
    if(!tz && !guildSettings["timezone"]) {
        message.channel.send("Enter a timezone using `!tz`");
        return;
    }
    if(!tz) {
        message.channel.send("You didn't enter a timezone, you are currently using `" + guildSettings["timezone"] + "`");
        return;
    }
    if(tz.indexOf("GMT") === -1 || (tz.indexOf("+") === -1 && tz.indexOf("-")) || tz.length !== 9 ) {
        message.channel.send("Please enter timezone in valid format, i.e. ``GMT+06:00``, please note this currently requires GMT");
        return;
    }
    if(guildSettings["timezone"] !== "") {
        message.channel.send("I've already been setup to use `" + guildSettings["timezone"] + "`, do you want to overwrite this and use `" + tz + "`? **(y/n)** ");
        const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, {time: 30000});
        collector.on("collect", (m) => {
            if(m.content.toLowerCase() === "y" || m.content.toLowerCase() === "yes") {
                guildSettings["timezone"] = tz;
                message.channel.send("Okay I'm adding your timezone as `" + tz + "`");
                helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
            }
            else {
                message.channel.send("Okay I won't do that.");
            }
            return collector.stop();
        });
      collector.on("end", (collected, reason) => {
          if(reason === "time") {
              message.channel.send("Command response timeout");
          }
      });
    }
    else {
        guildSettings["timezone"] = tz;
        message.channel.send("Okay I'm adding your timezone as `" + tz + "`");
        helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
    }
}
