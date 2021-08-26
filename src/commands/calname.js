// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { responseCollector } = require("~/handlers/responseCollector.js");

module.exports = {
  name: "calname",
  description: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    setCalName(message.channel, args, guild);
  }
};

/**
 * Send message with deletion timeout
 * @param {Snowflake} channel - channel to send message in
 * @param {String} content - content of message
 * @param {Number} [timeout=5000] - time in milliseconds before message is deleted
 */
function send(channel, content, timeout=5000) {
  channel.send(content)
    .then((message) => message.delete({ timeout }));
}

/**
 * Rename Calendar Name
 * @param {[String]} args - arguments passed in
 * @param {Guild} guild - Guild to pull settings from
 * @param {Snowflake} channel - Channel to respond to
 */
function setCalName(args, guild, channel) {
  let newCalName = args[0];
  // no name passed in
  if (!newCalName) return send(channel, i18n.t("collector.exist", {name: "$t(calendarname)", old: guild.getSetting("calendarName"), lng: guild.lng }));
  // chain togeter args
  else newCalName = args.join(" "); // join
  if (newCalName.length > 256) { return send("Calendar title cannot be more than 256 characters"); }
  send(channel, i18n.t("calname.prompt", { newCalName, lng: guild.lng }), 30000);
  responseCollector(channel, guild.lng).then(() => {
    guild.setSetting("calendarName", newCalName);
    debug(`calName | ${guild.id} | changed to ${newCalName}`);    
    return send(channel, i18n.t("calname.confirm", { newCalName, lng: guild.lng }));
  }).catch((err) => { discordLog(err);
  });
}
