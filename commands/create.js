// module imports
const { calendarUpdater } = require("~/handlers/calendarUpdater"); 
const { Guild } = require("~/handlers/guilds.js");
const { quickAddEvent } = require("~/handlers/calendar.js");

module.exports = {
  name: "create",
  description: "Create event on gCalendar",
  aliases: ["scrim"],
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    // fetch guild channel if exists
    // remove for portability
    const guildChannel = (guild.getSetting("channelid")
      ? message.client.channels.cache.get(guild.getSetting("channelid"))
      : message.channel);
    quickAddEvent(args, guild, message.channel);
    calendarUpdater(guild, guildChannel, true);
  }
};
