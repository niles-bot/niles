const path = require("path");
const helpers = require("./helpers.js");
const commands = require("./commands.js");
let allCommands = ["clean", "purge", "init", "update", "sync", "display", "create", "scrim", "delete", "stats", "info", "id", "tz", "invite", "prefix", "setup"];
const HELP_MESSAGE = "```\
        Niles Usage\n\
---------------------------\n\
!display             -  Display your calendar\n\
!update / !sync      -  Update the Calendar\n\
!create / !scrim     -  Create events using GCal's default interpreter - works best like !scrim xeno June 5 8pm - 9pm\n\
!delete              -  Delete an event using the form !delete Friday 8pm, ONLY works like this !delete <day> <starttime>\n\
!clean / !purge      -  Deletes messages in current channel, either !clean or !clean <number>\n\
!stats / !info       -  Display list of statistics and information about the Niles bot\n\
!invite              -  Get the invite link for Niles to join your server!\n\
!setup               -  Get details on how to setup Niles\n\
!id                  -  Set the Google calendar ID for the guild\n\
!tz                  -  Set the timezone for the guild\n\
!prefix              -  View or change the prefix for Niles\n\
!help                -  Display this message\n\
```\
Visit http://niles.seanecoffey.com for more info.";

function run(message) {
    //remove later
    if (!helpers.checkPermissions(message)) {
        if (helpers.mentioned(message, "help")) {
            message.author.send(HELP_MESSAGE);
            helpers.checkPermissionsManual(message, "help");
            return helpers.log("help & permissions DM sent");
          }
      return helpers.log("no permission to send messages.");
    }
    //remove later^^
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    const cmd = message.content.toLowerCase().substring(guildSettings.prefix.length).split(" ")[0];
    if (allCommands.includes(cmd) || helpers.mentioned(message, allCommands)) {
        helpers.checkPermissionsManual(message, cmd);
    }
    if (cmd === "help" || helpers.mentioned(message, "help")) {
        message.channel.send(HELP_MESSAGE);
    }
}

module.exports = {run};
