// package imports
const { totalmem } = require("os");
const { Duration } = require("luxon");
const { version } = require("discord.js");
const { errorLog } = require("~/src/handlers/errorLog.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const NILESVERSION = require("~/package.json").version;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Bot stats"),
  execute(interaction) {
    displayStats(interaction);
  }
};

/**
 * Display current bot stats
 * @param {Snowflake} interaction - interaction to reply to 
 */
function displayStats(interaction) {
  interaction.client.shard.fetchClientValues("guilds.cache.size").then((results) => {
    const usedMem = `${(process.memoryUsage().rss/1048576).toFixed()} MB`;
    const totalMem = (totalmem()>1073741824 ? (totalmem() / 1073741824).toFixed(1) + " GB" : (totalmem() / 1048576).toFixed() + " MB");
    const embedObj = {
      color: "RED",
      title: `Niles Bot ${NILESVERSION}`,
      url: "https://github.com/niles-bot/niles",
      fields: [
        {
          name: "Servers",
          value: `${results.reduce((acc, guildCount) => acc + guildCount, 0)}`,
          inline: true
        }, {
          name: "Uptime",
          value: Duration.fromObject({ seconds: process.uptime()}).toFormat("d:hh:mm:ss"),
          inline: true
        }, {
          name: "Ping",
          value: `${(interaction.client.ws.ping).toFixed(0)} ms`,
          inline: true
        }, {
          name: "RAM Usage",
          value: `${usedMem}/${totalMem}`,
          inline: true
        }, {
          name: "System Info",
          value: `${process.platform} (${process.arch})\n${totalMem}`,
          inline: true
        }, {
          name: "Libraries",
          value: `[Discord.js](https://discord.js.org) v${version}\nNode.js ${process.version}`,
          inline: true
        }, {
          name: "Links",
          value: `[Bot invite](https://discord.com/oauth2/authorize?permissions=97344&scope=bot&client_id=${interaction.client.user.id}) | [Support server invite](https://discord.gg/jNyntBn) | [GitHub](https://github.com/niles-bot/niles)`,
          inline: true
        }
      ],
      footer: { text: "Created by the Niles Bot Team" }
    };
    return interaction.reply({ embeds: [embedObj] });
  }).catch((err) => {
    errorLog(err);
  });
}
