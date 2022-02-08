import { SlashCommandBuilder } from "@discordjs/builders";
import { NilesGuild } from "utils/guilds";
import { CommandInteraction } from "discord.js";
import { Command } from "niles/types/command";
import Debug from "debug";
const debug = Debug("niles:cmd");

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
 * Set admin role
 * @param {Snowflake} interaction - initating interaction
 * @param {Guild} guild - guild to pull settings from
 */
async function setRoles(interaction: CommandInteraction, guild: NilesGuild) {
  const role = interaction.options.getRole("role").id;
  // add role
  debug(`setRoles | ${guild.id} | set role: ${role}`);
  interaction.reply(`Admin role set to \`<@&${role}>\``);
  await guild.set("discord", "admin", role);
}
