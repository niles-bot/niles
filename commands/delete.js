// package imports
const debug = require("debug")("niles:cmd");
const gCalendar = require("@googleapis/calendar").calendar;
// module imports
const calendar = require("~/handlers/calendar.js");
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { responseCollector } = require("~/handlers/responseCollector.js");
const { updateCalendar } = require("~/handlers/display.js");

module.exports = {
  name: "delete",
  description: true,
  usage: true,
  args: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    deleteEvent(args, guild, message.channel);
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
 * Search and return for event with given name
 * @param {String} summary - summary of event to search for 
 * @param {Guild} guild - Guild with calendar settings
 * @param {Snowflake} channel - channel to send errors to
 * @returns {Event} - event matching summary if exists
 */
function searchEventName(summary, guild, channel) {
  calendar.listEvents(guild)
    .then((resp) => {
      if (!resp.data) return; // return if no data
      for (let curEvent of resp.data.items) {
        if (curEvent.summary && summary.toLowerCase().trim() === curEvent.summary.toLowerCase().trim()) {
          return curEvent;
        }
      }
    }).catch((err) => {
      debug(`searchEventName | ${guild.id} | error ${err}`);
      discordLog(err);
      send(channel, i18n.t("deleteevent.error", {lng: guild.lng }));
    });
  return false;
}

/**
 * Delete specific event by ID
 * @param {String} eventID - ID of event to delete
 * @param {String} calendarID - ID of calendar to delete event form
 * @param {Snowflake} channel - callback channel
 */
function deleteEventById(eventID, calendarID, channel) {
  debug(`deleteEventById | ${channel.guild.id} | eventID: ${eventID}`);
  const guild = new Guild(channel.guild.id);
  const params = {
    calendarId: calendarID,
    eventId: eventID,
    sendNotifications: true
  };
  const gCal = gCalendar({version: "v3", auth: guild.getAuth()});
  return gCal.events.delete(params).then(() => {
    calendar.getEvents(guild, channel);
  }).catch((err) => {
    discordLog(`function deleteEventById error in guild: ${guild.id} : ${err}`);
  });
}

/**
 * Delete event on daymap with specific name
 * @param {[String]} args - command arguments
 * @param {Snowflake} channel - callback channel
 * @returns {Snowflake} command response
 */
function deleteEvent(args, guild, channel) {
  debug(`deleteEvent | ${guild.id} | args: ${args}`);
  const event = searchEventName(args.join(" "), guild, channel); // search for event
  if (!event) {
    send(channel, i18n.t("deleteevent.not_found", {lng: guild.lng }));
    return debug(`deleteEvent | ${guild.id} | no event within range`);
  }
  let promptDate = (event.start.dateTime ? event.start.dateTime : event.start.date);
  send(channel, i18n.t("deleteevent.prompt", {lng: guild.lng, summary: event.summary, promptDate}), 30000);
  const calendarID = guild.getSetting("calendarID");
  responseCollector(channel, guild.lng).then(() => { // collect yes
    deleteEventById(event.id, calendarID, channel)
      .then(() => { send(channel, i18n.t("deleteevent.confirm", {lng: guild.lng, summary: event.summary })); })
      .then((res) => { res.delete({ timeout: 10000 }); })
      .then(() => { updateCalendar(guild, channel, true); })
      .catch((err) => { discordLog(err);
      });
  });
}
