const { secrets } = require("~/settings.js"); 

/**
 * Format log messages with DateTime string
 * [Sun, 10 Sep 2001 00:00:00 GMT]
 * @param {Snowflake} message 
 */
const formatLogMessage = (message) => `[${new Date().toUTCString()}] ${message}`;

/**
 * Log Messages to discord channel and console
 * @param {DiscordClient}
 * @param {...any} logItems - items to log
 */
function discordLog(client, ...logItems) {
  const tripleGrave = "```";
  const logMessage = formatLogMessage(logItems.join(" "));
  const logChannelId = secrets.log_discord_channel;
  const pingAdmin = secrets.admins[0];
  // if no log channel just log to console
  if (!logChannelId) return console.log(logMessage);
  // send to all shards
  client.shard.broadcastEval(`
    // fetch log channel
    const channel = this.channels.cache.get('${logChannelId}');
    if (channel) { // check for channel on shard
      channel.send('${tripleGrave} ${logMessage} ${tripleGrave}');
      if ('${logMessage}'.includes("all shards spawned")) {
        channel.send("<@${pingAdmin}>");
      }
      console.log('${logMessage}');
    }
  `).catch((err) => console.log(err));
}

module.exports = {
  discordLog
};