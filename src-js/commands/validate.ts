// package imports
const { SlashCommandBuilder } = require("@discordjs/builders");
const { DateTime, IANAZone } = require("luxon");
let debug = require("debug")("niles:cmd");
const gCalendar = require("@googleapis/calendar").calendar;
// module imports
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { matchCalType } = require("~/handlers/matchCalType.js");
const updaterList = require("~/handlers/updaterList.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("validate")
    .setDescription("Check for any guild issues"),
  execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    debug = debug(guild.debug);
    validate(interaction, guild);
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
 * @param {Snowflake} interaction - callback for error messages
 */
function validateNextEvent(guild, interaction) {
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
    interaction.reply(`**Next Event:**
      **Summary:** \`${event.summary}\`
      **Start:** \`${event.start.dateTime || event.start.date }\`
      **Calendar ID:** \`${event.organizer.email}\`
    `);
    return true;
  }).catch((err) => { 
    interaction.reply(i18n.t("validate.calendar_error", {lng: guild.lng, err}));
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
 * @param {Snowflake} message - Message of channel to check
 * @returns {String} - returns missing permissions (if any)
 */
function permissionCheck(interaction) {
  debug(`permissionCheck | ${interaction.channel.guild.id}`);
  const minimumPermissions = ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "EMBED_LINKS", "ATTACH_FILES", "READ_MESSAGE_HISTORY"];
  const botPermissions = interaction.channel.permissionsFor(interaction.client.user).toArray();
  const missingPermissions = minimumPermissions.filter((perm) => !botPermissions.includes(perm)).join(", ");
  debug(`permissioncheck | missing: ${missingPermissions}`);
  return (missingPermissions);
}

/**
  * Checks for any issues with guild configuration
  * @param {Guild} guild - Guild to check agianst
  * @param {Snowflake} message - Message to respond to
  */
async function validate(interaction, guild) {
  debug(`validate | ${guild.id}`);
  const guildSettings = guild.getSetting();
  const missingPermissions = permissionCheck(interaction.channel);
  await interaction.reply(`**Checks**:
    **Timezone:** ${passFail(validateTz(guildSettings.timezone))}
    **Calendar ID:** ${passFail(matchCalType(guildSettings.calendarID))}
    **Calendar Test:** ${passFail(validateNextEvent(guild, interaction.channel))}
    **Missing Permissions:** ${missingPermissions ? missingPermissions : "🟢 None"}
    **On Updater List:** ${passFail(updaterList.exists(guild.id))}
    **Guild ID:** \`${guild.id}\`
    **Shard:** ${interaction.client.shard.ids}
  `);
}
