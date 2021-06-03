// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { killUpdateTimer } = require("~/handlers/updaterList.js");
const { responseCollector } = require("~/handlers/responseCollector.js");

module.exports = {
  name: "clean",
  description: "Clean messages",
  aliases: ["purge"],
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    cleanChannelWarn(args, message.channel, guild.lng);
  }
};

/**
 * Cleans messages from the channel
 * @param {Snowflake} channel - channel to delete the messages in
 * @param {Integer} numberMessages - number of messages to delete
 * @param {bool} deleteCal - delete calendar message
 */
function cleanChannel(channel, numMsg, deleteCal) {
  debug(`cleanChannel | ${channel.guild.id}`);
  numMsg = ((numMsg <= 97) ? numMsg+= 3 : 100); // add 3 messages from collector
  const guild = new Guild(channel.guild.id);
  const guildCalendarMessageID = guild.getCalendar("calendarMessageId");
  if (deleteCal) {
    guild.setCalendarID(""); // delete calendar id
    killUpdateTimer(guild.id, "clean");
    channel.bulkDelete(numMsg, true); // delete messages
  } else {
    channel.messages.fetch({ limit: numMsg })
      .then((messages) => { //If the current calendar is deleted
        messages.forEach(function(message) {
          if (guildCalendarMessageID && message.id === guildCalendarMessageID) messages.delete(message.id); // skip calendar message
        });
        return channel.bulkDelete(messages, true);
      });
  }
}

/**
 * Interface to warn users before deleting messages
 * @param {[String]} args - arguments passed in 
 * @param {Snowflake} channel - Channel to clean
 * @param {Guild} guild - Guild to pull locale from
 */
function cleanChannelWarn(args, channel, guild) {
  const argMessages = Number(args[0]);
  const deleteCalendar = Boolean(args[1]);
  const lng = guild.lng;
  if (!argMessages || isNaN(argMessages)) {
    return channel.send(i18n.t("delete.noarg", { lng }));
  } else {
    channel.send(i18n.t("delete.confirm", { lng, argMessages }));
    responseCollector(channel, lng)
      .then(() => cleanChannel(channel, argMessages, deleteCalendar))
      .catch((err) => discordLog(err));
  }
}
