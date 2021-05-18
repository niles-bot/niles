const defer = require("promise-defer");
const { DateTime, IANAZone, FixedOffsetZone } = require("luxon");
let bot = require("../bot.js");
const debug = require("debug")("niles:helpers");
const { i18n } = require("./strings.js");
const { secrets } = require("../settings.js"); 

// event types
const eventType = {
  NOMATCH: "nm",
  SINGLE: "se",
  MULTISTART: "ms",
  MULTIMID: "mm",
  MULTYEND: "me"
};

/**
 * Format log messages with DateTime string
 * [Sun, 10 Sep 2001 00:00:00 GMT]
 * @param {Snowflake} message 
 */
const formatLogMessage = (message) => `[${new Date().toUTCString()}] ${message}`;

/**
 * Log Messages to discord channel and console
 * @param  {...any} logItems - items to log
 */
function log(...logItems) {
  const logMessage = logItems.join(" ");
  const tripleGrave = "```";
  const logString = formatLogMessage(logMessage);
  const logChannelId = secrets.log_discord_channel;
  const superAdmin = secrets.admins[0];
  // if no log channel just log to console
  if (!logChannelId) return console.log(logString);
  // send to all shards
  bot.client.shard.broadcastEval(`
    // fetch log channel
    const channel = this.channels.cache.get('${logChannelId}');
    if (channel) { // check for channel on shard
      channel.send('${tripleGrave} ${logString} ${tripleGrave}');
      if ('${logString}'.includes("all shards spawned")) {
        channel.send("<@${superAdmin}>");
      }
      console.log('${logString}');
    }
  `).catch((err) => console.log(err));
}

/**
 * Validates timezone
 * @param {String} tz 
 * @returns {Boolean}
 */
const validateTz = (tz) => (IANAZone.isValidZone(tz) || (FixedOffsetZone.parseSpecifier(tz) !== null && FixedOffsetZone.parseSpecifier(tz).isValid));

/**
 * Make a guild setting formatted time string from timezone adjusted date object
 * @param {string} date - ISO datetimestring
 * @param {Guild} guild - Guild to get settings from
 * @return {string} - nicely formatted string for date event
 */
function getStringTime(date, guild) {
  debug(`getStringTime | ${guild.id}`);
  const format = guild.getSetting("format");
  const zDate = DateTime.fromISO(date, {setZone: true});
  return zDate.toLocaleString({ hour: "2-digit", minute: "2-digit", hour12: (format === 12), locale: guild.lng });
}

/**
 * Checks if user has required roles
 * @param {Snowflake} message - message from user to be checked
 * @returns {bool} - return if no allowed roles or user has role
 */
function checkRole(message, guildSettings) {
  debug(`checkRole | ${message.guild.id}`);
  const allowedRoles = guildSettings.allowedRoles;
  const userRoles = message.member.roles.cache.map((role) => role.name); // roles of user
  return (allowedRoles.length === 0 || userRoles.includes(allowedRoles[0]));
}

/**
 * Checks if the bot has all the nesseary permissions
 * @param {Snowflake} channel - Channel to check
 * @returns {String} - returns missing permissions (if any)
 */
function permissionCheck(channel) {
  debug(`permissionCheck | ${channel.guild.id}`);
  const minimumPermissions = ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "EMBED_LINKS", "ATTACH_FILES", "READ_MESSAGE_HISTORY"];
  const botPermissions = channel.permissionsFor(bot.client.user).toArray();
  const missingPermissions = minimumPermissions.filter((perm) => !botPermissions.includes(perm)).join(", ");
  debug(`permissioncheck | missing: ${missingPermissions}`);
  return (missingPermissions);
}

/**
 * Collects response for a message
 * @param {Snowflake} channel - Channel to create collector in
 * @param {String} lng - locale of response
 */
function yesThenCollector(channel, lng) {
  debug(`yesThenCollector | ${channel.guild.id}`);
  let p = defer();
  const collector = channel.createMessageCollector((msg) => !msg.author.bot, { time: 30000 });
  collector.on("collect", (m) => {
    if (["y", "yes"].includes(m.content.toLowerCase())) { p.resolve();
    } else {
      channel.send(i18n.t("collector.reject", { lng }));
      p.reject();
    }
    collector.stop();
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") return channel.send(i18n.t("collector.timeout", { lng }));
  });
  return p.promise;
}

/**
 * This function returns a classification of type 'eventType' to state the relation between a date and an event.
 * You can only check for the DAY relation, of checkDate, not the full dateTime relation!
 * @param {DateTime} checkDate - the Date to classify for an event
 * @param {DateTime} eventStartDate - the start Date() of an event
 * @param {DateTime} eventEndDate - the end Date() of an event
 * @return {string} eventType - A string of ENUM(eventType) representing the relation
 */
function classifyEventMatch(checkDate, eventStartDate, eventEndDate) {
  let eventMatchType = eventType.NOMATCH;
  // simple single day event
  if (checkDate.hasSame(eventStartDate, "day") && eventStartDate.hasSame(eventEndDate, "day")){
    eventMatchType = eventType.SINGLE;
  } else if (!eventStartDate.hasSame(eventEndDate, "day")) { // multi-day event
    // special case, Event ends as 12 AM spot on
    if (checkDate.hasSame(eventStartDate, "day") && eventEndDate.diff(eventStartDate.endOf("day"),"minutes") <= 1){
      eventMatchType = eventType.SINGLE;
    } else if (eventEndDate.diff(checkDate.startOf("day"),"minutes") <= 1){
      // this removes the entry for the next day of a 12AM ending event
      eventMatchType = eventType.NOMATCH;
    } else if (checkDate.hasSame(eventStartDate, "day")) {
      eventMatchType = eventType.MULTISTART;
    } else if (checkDate.hasSame(eventEndDate, "day")){
      eventMatchType = eventType.MULTYEND;
    } else if (checkDate.startOf("day") > eventStartDate.startOf("day") && checkDate.startOf("day") < eventEndDate.startOf("day") && eventEndDate.diff(checkDate.endOf("day"),"minutes") <= 1){
      // this makes the 12AM ending multi-day events show as ""..... - 12:00 AM"
      eventMatchType = eventType.MULTYEND;
    } else if (checkDate.startOf("day") > eventStartDate.startOf("day") && checkDate.startOf("day") < eventEndDate.startOf("day")){
      eventMatchType = eventType.MULTIMID;
    } 
  }
  // debug(`classifyEventMatch | type ${eventMatchType}`);
  return eventMatchType;
}

/**
 * This helper function limits the amount of chars in a string to max trimLength and adds "..." if shortened.
 * @param {string} eventName - The name/summary of an event
 * @param {int} trimLength - the number of chars to trim the title to
 * @return {string} eventName - A string wit max 23 chars length
 */
function trimEventName(eventName, trimLength){
  debug(`trimEventName | eventname: ${eventName}`);
  // remove json invalids
  eventName = eventName.replace("[\\.$|`|']/g", "\"");
  // if no trim length, just return
  if (trimLength === null || trimLength === 0) return eventName;
  // trim down to length
  if (eventName.length > trimLength) eventName = eventName.trim().substring(0, trimLength-3) + "...";
  return eventName;
}

/**
 * this helper function strips all html formatting from the description.
 * @param {string} inputString - the unclean string
 * @return {string} strippedString - string stripped of html
 */
function descriptionParser(inputString) {
  if (!inputString) return;
  debug(`descriptionParser | pre: ${inputString}`);
  const brRegex = /(<br>)+/gi; // match <br>
  const htmlRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi; // html tags
  let cleanString;
  try { cleanString = decodeURI(inputString); } // decode URI
  catch(e) { cleanString = inputString; }
  return cleanString.replace(brRegex, "\n").replace(htmlRegex, "").trim(); // replace <br> with \n and stripped html tags
}

/**
 * This function makes sure that the calendar matches a specified type
 * @param {String} calendarID - calendar ID to classify
 * @param {Snowflake} channel - Channel to send callback to
 * @param {Guild} guild - Guild to pull settings from
 * @returns {bool} - if calendar ID is valid
 */
function matchCalType(calendarID, channel, guild) {
  debug(`matchCalType | id: ${calendarID}`);
  // regex filter groups
  const groupCalId = RegExp("([a-z0-9]{26}@group.calendar.google.com)");
  const cGroupCalId = RegExp("^(c_[a-z0-9]{26}@)");
  const importCalId = RegExp("(^[a-z0-9]{32}@import.calendar.google.com)");
  const gmailAddress = RegExp("^([a-z0-9.]+@gmail.com)");
  const underscoreCalId = RegExp("^[a-z0-9](_[a-z0-9]{26}@)");
  const domainCalId = RegExp("^([a-z0-9.]+_[a-z0-9]{26}@)");
  const domainAddress = RegExp("(^[a-z0-9_.+-]+@[a-z0-9-]+.[a-z0-9-.]+$)");
  // filter through regex
  if (gmailAddress.test(calendarID)) { // matches gmail
  } else if (importCalId.test(calendarID)) { // matches import ID
  } else if (groupCalId.test(calendarID)) {
    if (cGroupCalId.test(calendarID)) { // matches cGroup
    } else if (domainCalId.test(calendarID)) { channel.send(i18n.t("caltype.domain", { lng: guild.lng }));
    } else if (underscoreCalId.test(calendarID)) { channel.send(i18n.t("caltype.underscore", { lng: guild.lng }));
    }
    return true; // normal group id or any variation
  } else if (domainAddress.test(calendarID)) { channel.send(i18n.t("caltype.domain", { lng: guild.lng }));
  } else { return false; // break and return false
  }
  return true; // if did not reach false
}

module.exports = {
  validateTz,
  log,
  getStringTime,
  checkRole,
  permissionCheck,
  yesThenCollector,
  classifyEventMatch,
  eventType,
  trimEventName,
  descriptionParser,
  matchCalType
};
