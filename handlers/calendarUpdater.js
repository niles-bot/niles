// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { getEvents } = require("~/handlers/calendar");
const { killUpdateTimer } = require("~/handlers/updaterList.js");
const { updateCalendar } = require("~/handlers/display.js");

/**
 * Fetches new events and then updates calendar for specified guild
 * @param {Guild} guild - Guild to start agianst 
 * @param {Snowflake} channel - channel to respond to
 * @param {bool} human - if initiated by human
 */
function calendarUpdater(guild, channel, human) {
  debug(`calendarUpdater | ${guild.id}`);
  try {
    getEvents(guild, channel);
    updateCalendar(guild, channel, human);
  } catch (err) {
    discordLog(`error in autoupdater in guild: ${guild.id} : ${err}`);
    killUpdateTimer(guild.id, "error in autoupdater");
  }
}

module.exports = {
  calendarUpdater
};
