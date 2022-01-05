import { SlashCommandBuilder } from "@discordjs/builders";
import { NilesGuild } from "../utils/guilds";
import { CommandInteraction } from "discord.js";
import { Command } from "../structures/command";
import { i18n } from "../utils/strings";
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
    const guild = new Guild(interaction.guildId);
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
  const discordSettings = await guild.get("discord");
  // add role
  debug(`setRoles | ${guild.id} | set role: ${role}`);
  await interaction.reply(i18n.t("admin.set", { lng: discordSettings.lng as string, role: `<@&${role}>` }));
  return guild.set("discord", "admin", role);
}
