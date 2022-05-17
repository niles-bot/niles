const { secrets } = require("./settings.js");
const Bree = require("bree");
const { ShardingManager } = require("discord.js");
const manager = new ShardingManager("./bot.js", { token: secrets.bot_token });
const debug = require("debug");
const { check } = require("./handlers/depCheck.js");

// first check for dependency issues
try {
  check();
} catch (err) {
  console.error(err);
  console.log(err);
  process.exit(1);
}

manager.spawn({ amount: "auto", delay: 1000 }); // spawn auto
manager.on("shardCreate", (shard) => {
  console.log(`Spawned shard ${shard.id}`);
});

const logger = {
  info: debug("niles:bree:info"),
  warn: debug("niles:bree:warn"),
  error: console.error
};

/**
 * Emit update message
 * @param {Client} client 
 * @param {Object} args - Arguments to pass through 
 */
function emitUpdate (client, { guild, channel}) {
  client.emit("nilesCalendarUpdate", guild, channel);
}

/**
 * handle worker messages
 * @param {{channel, guild}} msg 
 */
function workerMessageHandler(msg) {
  const { guild, channel } = msg.message;
  try {
    manager.broadcastEval(emitUpdate, { context: { guild, channel }});
  } catch (err) {
    console.log(err);
    if (err.name === "Error [SHARDING_NO_SHARDS]") process.exit();
  }
}

const bree = new Bree({
  jobs: [{
    name: "updater",
    interval: secrets.calendar_update_interval,
    timeout: "20s"
  }],
  workerMessageHandler,
  logger
});

bree.start();
