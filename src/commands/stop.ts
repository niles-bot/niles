const { killUpdateTimer } = require("~/handlers/updaterList.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { i18n } = require("~/src/handlers/strings.js");
const { Guild } = require("~/src/handlers/guilds.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop autoupdater"),
  execute(interaction) {
    const guildID = interaction.guild_id;
    const guild = new Guild(guildID);
    killUpdateTimer(guildID, "stop command");
    return interaction.reply(i18n.t("stop", { lng: guild.lng }));
  }
};
