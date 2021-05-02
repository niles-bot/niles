const { secrets } = require("./settings.js");
const Bree = require("bree");
const { ShardingManager } = require("discord.js");
const manager = new ShardingManager("./bot.js", { token: secrets.bot_token });
const debug = require("debug");

manager.spawn(4); // spawn auto
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
  manager.broadcastEval(`this.emit('nilesCalendarUpdate', '${guild}', '${channel}')`);
}

const bree = new Bree({
  jobs: [{
    name: "updater",
    interval: secrets.calendar_update_interval,
    timeout: "10s"
  }],
  workerMessageHandler,
  logger
});

bree.start();