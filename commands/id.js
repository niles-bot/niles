// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { matchCalType } = require("~/handlers/matchCalType.js");
const { responseCollector } = require("~/handlers/responseCollector.js");

module.exports = {
  name: "id",
  description: true,
  preSetup: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    setId(message.channel, args, guild);
  }
};

/**
 * set guild calendar id
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - command arguments
 * @param {Guild} guild - Guild to change ID for
 */
function setId(channel, args, guild) {
  debug(`setId | ${guild.id}`);
  const newCalendarID = args[0];
  const oldCalendarID = guild.getSetting("calendarID");
  if (!newCalendarID) {
    // no input, display current id
    if (oldCalendarID) channel.send(i18n.t("collector.exist", { name: "$t(calendarid)", old:oldCalendarID, lng: guild.lng }));
    // no input
    else channel.send(i18n.t("collector.noarg", { name: "$t(calendarid)", lng: guild.lng, example: "`!id`, i.e. `!id 123abc@123abc.com`" }));
  }
  // did not pass validation
  else if (!matchCalType(newCalendarID, channel, guild)) {
    debug(`setId | ${guild.id} | failed calType`);
    channel.send(i18n.t("collector.invalid", { name: "$t(calendarid)", lng: guild.lng }));
  // overwrite calendarid, passed validation
  } else if (oldCalendarID) {
    channel.send(i18n.t("collector.overwrite_prompt", { old: oldCalendarID, new: newCalendarID, lng: guild.lng }));
    responseCollector(channel, guild.lng).then(() => {
      debug(`setId | ${guild.id} | set to newID: ${newCalendarID}`);
      return guild.setSetting("calendarID", newCalendarID);
    }).catch((err) => { discordLog(err);
    });
  // no set calendarid, passed validation
  } else {
    debug(`setId | ${guild.id} | set to new ID: ${newCalendarID}`);
    guild.setSetting("calendarID", newCalendarID);
  }
}
