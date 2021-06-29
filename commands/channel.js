// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { responseCollector } = require("~/handlers/responseCollector.js");

module.exports = {
  name: "channel",
  description: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    setChannel(message.channel, args, guild);
  }
};

/**
 * Send message with deletion timeout
 * @param {Snowflake} channel - channel to send message in
 * @param {String} content - content of message
 * @param {Number} [timeout=5000] - time in milliseconds before message is deleted
 */
function send(channel, content, timeout=5000) {
  channel.send(content)
    .then((message) => message.delete({ timeout }));
}

/**
 * Sets current channel to be Calendar channel
 * @param {[String]} args - arguments passed in 
 * @param {Guild} guild - Guild to set
 * @param {Snowflake} channel - Channel to respond to
 */
function setChannel(message, args, guild) {
  debug(`setChannel | ${guild.id}`);
  if (!args[0]) {
    const guildChannelId = guild.getSetting("channelid");
    if (guildChannelId) { // if existing channel
      const guildChannel = message.client.channels.cache.get(guildChannelId);
      send(message.channel, i18n.t("setchannel.current", { name: guildChannel.name, lng: guild.lng }));
    // if no channel set
    } else { send(message.channel, i18n.t("setchannel.not_set", { lng: guild.lng })); }
    // no arguments
    send(message.channel, i18n.t("setchannel.help", { lng: guild.lng }));
  } else if (args[0] === "delete") { // remove channel
    debug(`setChannel | ${guild.id} | delete`);
    guild.setSetting("channelid", "");
    send(message.channel, i18n.t("setchannel.delete", { lng: guild.lng }));
  } else if (args[0] === "set") {
    debug(`setChannel | ${guild.id} | set: ${message.channel.name}`);
    send(message.channel, i18n.t("setchannel.prompt", { channel: message.channel.name, lng: guild.lng }), 30000);
    // set after collecting yes
    responseCollector(message.channel, guild.lng).then(() => { return guild.setSetting("channelid", message.channel.id);
    }).catch((err) => { discordLog(err);
    });
  }
}
