// package imports
const debug = require("debug")("niles:cmd");
const gCalendar = require("@googleapis/calendar").calendar;
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const eventHelper = require("~/handlers/eventHelper.js");
const { i18n } = require("~/handlers/strings.js");
const { killUpdateTimer } = require("~/handlers/updaterList.js");

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

/**
 * Adds an event to google calendar via quickAddEvent
 * @param {[String]} args - Arguments passed in 
 * @param {Guild} guild - Guild to work agianst
 * @param {Snowflake} channel - Channel to callback to
 */
function quickAddEvent(args, guild, channel) {
  debug(`quickAddEvent | ${guild.id} | args ${args}`);
  if (!args[0]) return send(channel, i18n.t("quick_add.noarg", { lng: guild.lng }));
  const params = {
    calendarId: guild.getSetting("calendarID"),
    text: args.join(" ") // join
  };
  const gCal = gCalendar({version: "v3", auth: guild.getAuth()});
  gCal.events.quickAdd(params).then((res) => {
    const promptDate = (res.data.start.dateTime ? res.data.start.dateTime : res.data.start.date);
    return send(channel, i18n.t("quick_add.confirm", { lng: guild.lng, summary: res.data.summary, promptDate }));
  }).catch((err) => { discordLog(`function quickAddEvent error in guild: ${guild.id} : ${err}`);
  });
}


module.exports = {
  listEvents,
  getEvents,
  quickAddEvent
};