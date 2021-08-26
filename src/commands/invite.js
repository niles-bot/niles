const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Invite Niles to your server"),
  execute(interaction) {
    const inviteEmbed = {
      description: `Click [here](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${interaction.client.user.id}) to invite me to your server`,
      color: 0xFFFFF
    };
    return interaction.reply({ embeds: [inviteEmbed]});
  }
};