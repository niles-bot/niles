const debug = require("~/src/handlers/logger")(true);
const { SlashCommandBuilder } = require("@discordjs/builders");
const { Guild, recreateGuild } = require("~/src/handlers/guilds.js");
const { i18n } = require("~/src/handlers/strings.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("init")
    .setDescription("Reset Niles settings to default"),
  execute(interaction) {
    const id = interaction.guild_id;
    const guild = new Guild(interaction.guild_id);
    debug(`init | ${id}`);
    interaction.reply(i18n.t("reset", {lng: guild.lng}));
    return recreateGuild(id);
  }
};