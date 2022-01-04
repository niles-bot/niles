// package imports
const { SlashCommandBuilder } = require("@discordjs/builders");
// module imports
const { getEvents } = require("~/handlers/calendar.js");
const { postCalendar } = require("~/handlers/display.js");
const { Guild } = require("~/handlers/guilds.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("calendar")
    .setDescription("Calendar Display")
    .addSubCommand((subcommand) => 
      subcommand
        .setName("display")
        .setDescription("Display calendar")
    )
    .addSubCommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Update calendar")
    ),
  async execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    const events = await getEvents(guild);

    postCalendar(guild, (guild.getSetting("channel") || interaction.channel));
   
  }
};

const send