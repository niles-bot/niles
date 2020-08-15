const path = require("path");
const helpers = require("./helpers.js");
const commands = require("./commands.js");
const strings = require("./strings.js");
let allCommands = ["help", "clean", "purge", "init", "update", "sync", "display", "create", "scrim", "delete", "stats", "info", "id", "tz", "invite", "prefix", "admin", "setup", "shard", "count", "ping", "displayoptions", "timers", "reset"];

function run(message) {
  //remove later
  if (!helpers.checkPermissions(message)) {

    let cmd = message.content.toLowerCase().substring(1).split(" ")[0];

    if (allCommands.includes(cmd)) {
      helpers.checkPermissionsManual(message, cmd);
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
    message.channel.send(strings.HELP_MESSAGE);
  }
}

module.exports = {
  run,
  allCommands
};
