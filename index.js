const settings = require("./settings.js");
const Bree = require("bree");
const { ShardingManager } = require("discord.js");
const manager = new ShardingManager("./bot.js", { token: settings.secrets.bot_token });
const debug = require("debug");

manager.spawn(); // spawn auto
manager.on("shardCreate", (shard) => {
  console.log(`Spawned shard ${shard.id}`);
});

const logger = {
  info: debug("niles:bree:info"),
  warn: debug("niles:bree:warn"),
  error: console.error
};

/**
 * handle worker messages
 * @param {{channel, guild}} msg 
 */
function workerMessageHandler(msg) {
  const { guild, channel } = msg.message;
  // fetch and check for channel
  manager.broadcastEval(`
    try {
      const uChannel = this.channels.cache.get('${channel}');
      if (uChannel) this.workerUpdate('${guild}', '${channel}')
    } catch (err) {
      if (err.name === "Error [SHARDING_IN_PROCESS]") console.log("spawning shards ...");
    }
  `);
}

const bree = new Bree({
  jobs: [{
    name: "updater",
    interval: settings.secrets.calendar_update_interval,
    timeout: "10s"
  }],
  workerMessageHandler,
  logger
});

bree.start();