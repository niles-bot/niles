const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("pong"),
  execute(interaction) {
    interaction.reply(`:ping_pong: !Pong! ${(interaction.client.ws.ping).toFixed(0)}ms`);
  }
};