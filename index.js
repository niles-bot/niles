let settings = require("./settings.js");

const { ShardingManager } = require("discord.js");
const manager = new ShardingManager("./bot.js", { token: settings.secrets.bot_token });

/// warn users about master branch
console.log("Niles no longer uses the master branch - please update your local deployment to use the main branch instead. For instructions, see https://git.io/Jt9T4");
/// warn users about master branch

manager.spawn(); // spawn auto
manager.on("shardCreate", (shard) => {
  console.log(`Spawned shard ${shard.id}`);
});
