const { Guild } = require("~/guilds.js");
const debug = require("debug")("niles:cmd");
const { calendarUpdater } = require("~/handlers/calendarUpdater.js");

/**
 * starts workerUpdate from sidecar
 * @param {String} guildid
 * @param {Snowflake} channel
 */
function workerUpdate (guildid, channel) {
  const guild = new Guild(guildid);
  debug(`workerUpdate | ${guild.id} | ${channel.id}`);
  calendarUpdater(guild, channel, false);
}

module.exports = {
  workerUpdate
};
