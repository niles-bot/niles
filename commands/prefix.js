// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { responseCollector } = require("~/handlers/responseCollector.js");

module.exports = {
  name: "prefix",
  description: "Set prefix",
  preSetup: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    setPrefix(message.channel, args, guild);
  }
};

/**
 * Sets guild prefix
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - arguments passed in
 * @param {Guild} guild - Guild to change prefix for
 */
function setPrefix(channel, args, guild) {
  debug(`setPrefix | ${guild.id}`);
  const newPrefix = args[0];
  if (!newPrefix) { channel.send(i18n.t("collector.exist", { old: guild.prefix, name: "prefix", lng: guild.lng }));
  } else if (newPrefix) {
    channel.send(`Do you want to set the prefix to \`${newPrefix}\` ? **(y/n)**`);
    responseCollector(channel, guild.lng).then(() => {
      debug(`setPrefix | ${guild.id} | set to: ${newPrefix}`);
      channel.send(`prefix set to ${newPrefix}`);
      return guild.setSetting("prefix", newPrefix);
    }).catch((err) => { discordLog(err); });
  }
}
