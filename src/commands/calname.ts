const { SlashCommandBuilder } = require("@discordjs/builders");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
let debug = require("~/src/handlers/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("calname")
    .setDescription("Set calendar display name")
    .addStringOption((calname) =>
      calname
        .setName("calname")
        .setDescription("Calendar Name")
    ),
  execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    debug = debug(guild.debug);
    setCalName(interaction, guild);
  }
};

/**
 * Rename Calendar Name
 * @param {[String]} args - arguments passed in
 * @param {Guild} guild - Guild to pull settings from
 */
function setCalName(interaction, guild) {
  const calname = interaction.options.getString("calname") || "CALENDAR";
  if (calname.length > 256) {
    debug(`calname | ${guild.id} | toolong`);
    return interaction.reply(i18n.t("calname.toolong", { lng: guild.lng }));
  }
  guild.setSetting("calendarName", calname);
  debug(`calname | ${guild.id} | ${calname}`);
  return interaction.reply(i18n.t("calname.confirm", { calname, lng: guild.lng }));
}