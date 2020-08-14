let settings = require("./settings.js");

const { ShardingManager } = require('discord.js');
const manager = new ShardingManager('./bot.js', { token: settings.secrets.bot_token });

manager.spawn() // spawn auto
manager.on('shardCreate', (shard) => {
  console.log(`Spawned shard ${shard.id}`);
});
