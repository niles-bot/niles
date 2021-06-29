// module imports
const { getEvents } = require("~/handlers/calendar.js");
const { Guild } = require("~/handlers/guilds.js");

module.exports = {
  name: "get",
  description: true,
  execute(message, args) {
    args;
    const guild = new Guild(message.channel.guild.id);
    getEvents(guild, message.channel);
  }
};
