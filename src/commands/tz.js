// package imports
const debug = require("debug")("niles:cmd");
const soft = require("timezone-soft");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { responseCollector } = require("~/handlers/responseCollector.js");

module.exports = {
  name: "tz",
  description: true,
  preSetup: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    setTz(message.channel, args, guild);
  }
};

/**
 * set guild tz
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - arguments passed in 
 * @param {Guild} guild - Guild getter to change settings for
 */
function setTz(channel, args, guild) {
  debug(`tz | ${guild.id}`);
  const currentTz = guild.getSetting("timezone");
  const input = args.join(" "); // join arguments for parsing
  const tzObj = soft(input)[0];
  if (!input) { // no input
    // no current tz
    if (!currentTz) channel.send(i18n.t("collector.noarg", { name: "$t(timezone)", lng: guild.lng, example: "`!tz America/New_York` or `!tz UTC+4` or `!tz EST`"}));
    // timezone define
    else channel.send(i18n.t("collector.exist", { name: "$t(timezone)", lng: guild.lng, old: currentTz }));
  }
  // valid input
  else if (tzObj) { // tz parser
    const tz = tzObj.iana;
    if (currentTz) { // timezone set
      channel.send(i18n.t("collector.overwrite_prompt", { lng: guild.lng, old: currentTz, new: tz }));
      responseCollector(channel, guild.lng).then(() => {
        debug(`setTz | ${guild.id} | set to new tz: ${tz}`);
        channel.send(i18n.t("tz.confirm", { lng: guild.lng, tz: tz }));
        return guild.setSetting("timezone", tz);
      }).catch((err) => { discordLog(err);
      });
    } else { // timezone is not set
      debug(`setTz | ${guild.id} | set to new tz: ${tz}`);
      guild.setSetting("timezone", tz);
    }
  // fails validation
  } else {
    debug(`setTz | ${guild.id} | failed validation: ${input}`);
    channel.send(i18n.t("collector.invalid", { name: "$t(timezone)", lng: guild.lng }));
  }
}
