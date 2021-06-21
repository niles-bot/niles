module.exports = {
  name: "invite",
  description: "Generate Niles bot invite link",
  preSetup: true,
  execute(message, args) {
    args;
    const inviteEmbed = {
      description: `Click [here](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${message.client.user.id}) to invite me to your server`,
      color: 0xFFFFF };
    message.channel.send({ embed: inviteEmbed });
  }
};