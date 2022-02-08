import { SlashCommandBuilder } from "@discordjs/builders";
import { NilesGuild } from "utils/guilds";
import { CommandInteraction } from "discord.js";
import { Command } from "niles/types/command";
import Debug from "debug";
const debug = Debug("niles:cmd");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("calname")
    .setDescription("Set calendar display name")
    .addStringOption((calname) =>
      calname
        .setName("calname")
        .setDescription("Calendar Name")
    ),
  execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    debug = debug(guild.debug);
    setCalName(interaction, guild);
  }
};

export default {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Set allowed role")
    .addRoleOption((option) =>
      option.setName("role")
        .setDescription("Role to allow to interact with Niles")),
  execute(interaction: CommandInteraction) {
    const guild = new NilesGuild(interaction.guildId);
    setRoles(interaction, guild);
  }
} as Command;


/**
 * Rename Calendar Name
 * @param {[String]} args - arguments passed in
 * @param {Guild} guild - Guild to pull settings from
 */
function setCalName(interaction, guild) {
  const calname = interaction.options.getString("calname") || "CALENDAR";
  if (calname.length > 256) {
    debug(`calname | ${guild.id} | toolong`);
    return interaction.reply(i18n.t("calname.toolong", { lng: guild.lng }));
  }
  guild.setSetting("calendarName", calname);
  debug(`calname | ${guild.id} | ${calname}`);
  return interaction.reply(i18n.t("calname.confirm", { calname, lng: guild.lng }));
}