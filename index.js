const settings = require("./settings.js");
const Bree = require("bree");
const { ShardingManager } = require("discord.js");
const manager = new ShardingManager("./bot.js", { token: settings.secrets.bot_token });

manager.spawn(); // spawn auto
manager.on("shardCreate", (shard) => {
  console.log(`Spawned shard ${shard.id}`);
});

/**
 * handle worker messages
 * @param {{channel, guild}} msg 
 */
function workerMessageHandler(msg) {
  manager.broadcastEval(`
    // fetch & check for channel
    const channel = this.channels.cache.get('${msg.channel}');
    if (channel) this.workerUpdate()
  `);
}

const bree = new Bree({
  jobs: [{
    name: "updater",
    interval: settings.secrets.calendar_update_interval,
    timeout: 0
  }],
  workerMessageHandler
});

bree.start();