const { client } = require("../bot.js");
const { secrets } = require("../settings.js"); 
/**
 * Format log messages with DateTime string
 * [Sun, 10 Sep 2001 00:00:00 GMT]
 * @param {Snowflake} message 
 */
const formatLogMessage = (message) => `[${new Date().toUTCString()}] ${message}`;

/**
 * Log Messages to discord channel and console
 * @param  {...any} logItems - items to log
 */
function log(...logItems) {
  const logMessage = logItems.join(" ");
  const tripleGrave = "```";
  const logString = formatLogMessage(logMessage);
  const logChannelId = secrets.log_discord_channel;
  const superAdmin = secrets.admins[0];
  // if no log channel just log to console
  if (!logChannelId) return console.log(logString);
  // send to all shards
  client.shard.broadcastEval(`
    // fetch log channel
    const channel = this.channels.cache.get('${logChannelId}');
    if (channel) { // check for channel on shard
      channel.send('${tripleGrave} ${logString} ${tripleGrave}');
      if ('${logString}'.includes("all shards spawned")) {
        channel.send("<@${superAdmin}>");
      }
      console.log('${logString}');
    }
  `)
    .catch((err) => console.log(err));
}

module.exports = {
  log
};
