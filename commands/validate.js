const gCalendar = require("@googleapis/calendar").calendar;
const { DateTime, IANAZone } = require("luxon");
const debug = require("debug")("niles:cmd");
const { i18n } = require("~/handlers/strings.js");
const updaterList = require("~/handlers/updaterList.js");
const { matchCalType } = require("~/handlers/matchCalType.js");
const { Guild } = require("~/handlers/guilds.js");

module.exports = {
  name: "validate",
  description: "Checks for any errors with settings",
  execute(message, args) {
    args;
    const guild = new Guild(message.channel.guild.id);
    validate(guild, message);
  }
};

/**
 * Returns pass or fail instead of boolean
 * @param {boolean} bool
 * @returns {String}
 */
const passFail = (bool) => (bool ? "Passed 🟢" : "Failed 🔴");

/**
 * Get next event for validation
 * @param {Guild} guild - Guild to pull calendar ID from
 * @param {Snowflake} channel - callback for error messages
 */
function validateNextEvent(guild, channel) {
  const gCal = gCalendar({version: "v3", auth: guild.getAuth()});
  const params = {
    calendarId: guild.getSetting("calendarID"),
    timeMin: DateTime.local().toISO(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 1
  };
  gCal.events.list(params).then((res) => {
    const event = res.data.items[0];
    channel.send(`**Next Event:**
      **Summary:** \`${event.summary}\`
      **Start:** \`${event.start.dateTime || event.start.date }\`
      **Calendar ID:** \`${event.organizer.email}\`
    `);
    return true;
  }).catch((err) => { 
    channel.send(i18n.t("validate.calendar_error", {lng: guild.lng, err}));
    return false;
  });
}

/**
 * Validates timezone
 * @param {String} tz 
 * @returns {Boolean}
 */
const validateTz = (tz) => IANAZone.isValidZone(tz);

/**
 * Checks if the bot has all the nesseary permissions
 * @param {Snowflake} channel - Channel to check
 * @returns {String} - returns missing permissions (if any)
 */
function permissionCheck(message) {
  debug(`permissionCheck | ${message.channel.guild.id}`);
  const minimumPermissions = ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "EMBED_LINKS", "ATTACH_FILES", "READ_MESSAGE_HISTORY"];
  const botPermissions = message.channel.permissionsFor(message.client.user).toArray();
  const missingPermissions = minimumPermissions.filter((perm) => !botPermissions.includes(perm)).join(", ");
  debug(`permissioncheck | missing: ${missingPermissions}`);
  return (missingPermissions);
}

/**
  * Checks for any issues with guild configuration
  * @param {Guild} guild - Guild to check agianst
  * @param {Snowflake} message - Message to respond to
  * @returns {bool} - if calendar fetches successfully
  */
function validate(guild, message) {
  debug(`validate | ${guild.id}`);
  const guildSettings = guild.getSetting();
  const missingPermissions = permissionCheck(message);
  message.channel.send(`**Checks**:
    **Timezone:** ${passFail(validateTz(guildSettings.timezone))}
    **Calendar ID:** ${passFail(matchCalType(guildSettings.calendarID, message.channel, guild))}
    **Calendar Test:** ${passFail(validateNextEvent(guild, message.channel))}
    **Missing Permissions:** ${missingPermissions ? missingPermissions : "🟢 None"}
    **On Updater List:** ${passFail(updaterList.exists(guild.id))}
    **Guild ID:** \`${guild.id}\`
    **Shard:** ${message.client.shard.ids}
  `);
}
