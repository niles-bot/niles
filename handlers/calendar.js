const gCalendar = require("@googleapis/calendar").calendar;
const debug = require("debug")("niles:cmd");
const { i18n } = require("~/handlers/strings.js");
const { discordLog } = require("~/handlers/discordLog.js");
const eventHelper = require("~/handlers/eventHelper.js");

/**
 * List events within date range
 * @param {Guild} guild - Guild to pull from
 */
function listEvents(guild) {
  debug(`listEvents | ${guild.id}`);
  const dayMap = guild.getDayMap();
  const calendarID = guild.getSetting("calendarID");
  const gCal = gCalendar({version: "v3", auth: guild.getAuth()});
  const params = {
    calendarId: calendarID,
    timeMin: dayMap[0].toISO(),
    timeMax: dayMap[6].toISO(),
    singleEvents: true,
    timeZone: guild.tz,
    orderBy: "startTime"
  };
  return gCal.events.list(params);
}

/**
 * handles errors from getEvents
 * @param {Error} err - Error with information
 * @param {Guild} guild - Guild to get language and ID from
 * @param {Snowflake} channel - Channel to respond to
 */
function getEventsErrorHandler(err, guild, channel) {
  debug(`getEvents | ${guild.id} | ${err}`);
  if (err.code === 404) {
    discordLog(`getEvents error in guild: ${guild.id} : 404 error can't find calendar`);
    channel.send(i18n.t("no_cal", { lng: guild.lng }));
  } else if (err.code === 401) { discordLog(`getEvents error in guild: ${guild.id} : 401 invalid credentials`);
  } else { discordLog(`getEvents error in guild: ${guild.id} : ${err}`);
  }
  channel.send(i18n.t("timerkilled", { lng: guild.lng }));
  killUpdateTimer(guild.id, "getEvents");
}

/**
 * Get Events from Google Calendar
 * @param {Guild} guild - Guild to pull settings from
 * @param {Snowflake} channel - channel to respond to
 */
function getEvents(guild, channel) {
  debug(`getEvents | ${guild.id}`);
  guild.update(); // update guild
  const dayMap = guild.getDayMap();
  const auth = guild.getAuth();
  const tz = guild.tz;
  let events = {};
  // construct calendar with old calendar file
  const params = {
    calendarId: guild.getSetting("calendarID"),
    timeMin: dayMap[0].toISO(),
    timeMax: dayMap[dayMap.length-1].endOf("day").toISO(), // get all events of last day!
    singleEvents: true,
    orderBy: "startTime",
    timeZone: tz
  };
  const gCal = gCalendar({version: "v3", auth});
  try {
    gCal.events.list(params).then((res) => {
      debug(`getEvents - list | ${guild.id}`);
      for (let day = 0; day < dayMap.length; day++) {
        let key = "day" + String(day);
        let matches = [];
        res.data.items.map((event) => {
          let eType = eventHelper.eventTimeCorrector(dayMap[day], event, tz);
          if (eType !== event.eventType.NOMATCH) {
            matches.push({
              id: event.id,
              summary: event.summary,
              start: event.start,
              end: event.end,
              description: eventHelper.descriptionParser(event.description),
              location: event.location || event.hangoutLink,
              type: eType
            });
          }
          events[key] = matches;
        });
      }
      guild.setEvents(events);
    }).catch((err) => {
      getEventsErrorHandler(err, guild, channel);
    });
  } catch (err) {
    channel.send(err.code);
    return discordLog(`Error in function getEvents in guild: ${guild.id} : ${err}`);
  }
}

module.exports = {
  listEvents,
  getEvents
};