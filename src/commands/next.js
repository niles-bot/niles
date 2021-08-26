// package imports
const debug = require("debug")("niles:cmd");
const { DateTime } = require("luxon");
// module imports
const calendar = require("~/handlers/calendar.js");
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");

module.exports = {
  name: "next",
  description: true,
  execute(message, args) {
    args;
    const guild = new Guild(message.channel.guild.id);
    nextEvent(guild, message.channel);
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
 * Converts duration to human-readable string
 * @param {Object} duration - duration to convert
 * @returns {String} - String represenation of duration
 */
function durationToString(duration) {
  let timeToString = "";
  if (duration.days) timeToString += `${duration.days} days `;
  if (duration.hours) timeToString += `${duration.hours} hours `;
  if (duration.minutes) timeToString += `${duration.minutes} minutes`;
  return timeToString;
}

/**
 * Displays the next upcoming event in the calendar file
 * @param {Snowflake} channel - Channel to respond to
 * @returns {Snowflake} response with confirmation or failiure
 */
function nextEvent(guild, channel) {
  debug(`nextEvent | ${guild.id}`);
  const now = DateTime.local().setZone(guild.tz);
  calendar.listEvents(guild).then((resp) => {
    if (!resp.data) return; // return if no data
    for (const eventObj of resp.data.items) {
      // create luxon date from dateTime or date
      const luxonDate = DateTime.fromISO(eventObj.start.dateTime || eventObj.start.date);
      if (luxonDate > now) { // make sure event happens in the future
        // description is passed in - option to be added
        const timeToString = durationToString(
          luxonDate.diff(now)
            .shiftTo("days", "hours", "minutes", "seconds").toObject());
        return channel.send(i18n.t("next.next", { summary: eventObj.summary, timeToString, lng: guild.lng }));
      }
    }
    // run if message not sent
    debug(`nextEvent | ${guild.id} | no upcoming`);
    return send(channel, i18n.t("next.no_upcoming", {lng: guild.lng }), 10000);
  }).catch((err) => { discordLog(err);
  });
}
