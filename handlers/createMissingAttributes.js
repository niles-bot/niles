let helpers = require("./helpers.js");
const path = require("path");

//Update database files when new vars are added.
function writeSetting(message, value, setting) {
  let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
  let guildSettings = helpers.readFile(guildSettingsPath);
  guildSettings[setting] = value;
  helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
}

function allowedRoles(message) {
  let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
  let guildSettings = helpers.readFile(guildSettingsPath);
  if (!guildSettings.allowedRoles) {
    writeSetting(message, [], "allowedRoles");
    helpers.log("update database settings file for guild: " + message.guild.id);
    return true;
  }
  return false;
}

module.exports = {
  allowedRoles
};
