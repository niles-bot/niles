// module imports
const { SlashCommandBuilder } = require("@discordjs/builders");
const { Guild } = require("~/src/handlers/guilds.js");
const { i18n } = require("~/src/handlers/strings.js");
const { matchCalType } = require("~/src/handlers/matchCalType.js");
let debug = require("~/src/handlers/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("id")
    .setDescription("Set Google Calendar ID for the guild")
    .addStringOption((calid) =>
      calid
        .setName("calid")
        .setDescription("Google Calendar ID")
        .setRequired(true)
    ),
  execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    debug = debug(guild.debug);
    setId(interaction, guild);
  }
};

/**
 * set guild calendar id
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - command arguments
 * @param {Guild} guild - Guild to change ID for
 */
function setId(interaction, guild) {
  const calendarID = interaction.options.getString("calid");
  debug(`setId | ${guild.id} | ${calendarID}`);
  // passed validation
  if (matchCalType(calendarID)) {
    debug(`setId | ${guild.id} | set`);
    guild.setSetting("calendarID", calendarID);
    return interaction.reply(i18n.t("id.success", { calendarID }));
  } else {
    debug(`setId | ${guild.id} | failed calType`);
    return interaction.reply(i18n.t("id.invalid", { lng: guild.lng }));
  }
}
