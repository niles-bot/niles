// module imports
const { doHandler } = require("./displayoptions.js");
const { Guild } = require("~/handlers/guilds.js");

module.exports = {
  name: "displayoptions",
  description: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    doHandler(args, guild, message.channel);
  }
};