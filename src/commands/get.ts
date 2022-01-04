const { SlashCommandBuilder } = require("@discordjs/builders");
const { getEvents } = require("~/src/handlers/calendar.js");
const { Guild } = require("~/src/handlers/guilds.js");
let debug = require("~/src/handlers/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("get")
    .setDescription("Update the local cache of events"),
  execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    debug = debug(guild.debug);
    debug(`get | ${guild.id}`);
    getEvents(guild, interaction);
  }
};
