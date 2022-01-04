// module imports
const { getEvents } = require("~/handlers/calendar.js");
const { postCalendar } = require("~/handlers/display.js");
const { Guild } = require("~/handlers/guilds.js");

module.exports = {
  name: "display",
  description: true,
  execute(message, args) {
    args;
    const guild = new Guild(message.channel.guild.id);
    getEvents(guild, message.channel);
    postCalendar(guild, message.channel);
  }
};
