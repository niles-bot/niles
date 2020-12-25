const path = require("path");
const helpers = require("./helpers.js");
const strings = require("./strings.js");
let bot = require("../bot.js");
let allCommands = ["help", "clean", "purge", "init", "update", "sync", "display", "create", "scrim", "delete", "stats", "info", "id", "tz", "invite", "prefix", "admin", "setup", "shard", "count", "ping", "displayoptions", "timers", "reset", "next", "validate"];

function run(message) {
  //remove later
  if (!helpers.checkPermissions(message)) {
    let cmd = message.content.toLowerCase().substring(1).split(" ")[0];
    if (allCommands.includes(cmd)) {
      helpers.checkPermissions(message, cmd);
      return helpers.log("help & permissions DM sent");
    }
    return helpers.log("no permission to send messages.");
  }
  //remove later^^
  let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
  let guildSettings = helpers.readFile(guildSettingsPath);
  const args = message.content.slice(guildSettings.prefix.length).trim().split(' ');
  // if mentioned return second object as command, if not - return first object as command
  let cmd = (message.mentions.has(bot.client.user.id) ? args.splice(0, 2)[1] : args.shift())
  cmd = cmd.toLowerCase();
  if (allCommands.includes(cmd)) {
    helpers.checkPermissions(message, cmd);
  }
  if (["help"].includes(cmd)) {
    message.channel.send(strings.HELP_MESSAGE);
  }
}

module.exports = {
  run,
  allCommands
};
