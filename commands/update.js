// module imports
const { calendarUpdater } = require("~/handlers/calendarUpdater.js");
const { Guild } = require("~/handlers/guilds.js");

module.exports = {
  name: "update",
  description: "Update displayed calendar",
  aliases: ["sync"],
  execute(message, args) {
    args;
    const guild = new Guild(message.channel.guild.id);
    calendarUpdater(guild, message.channel, true);
  }
};
