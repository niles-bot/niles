import { SlashCommandBuilder } from "@discordjs/builders";
import { NilesGuild } from "../utils/guilds";
import { CommandInteraction } from 'discord.js';
import { Command } from '../structures/command';
const { i18n } = require("../utils/strings");
let debug = require("../utils/logger");

export default {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Set allowed role")
    .addRoleOption((option) => 
      option.setName("role")
        .setDescription("Role to allow to interact with Niles")),
  execute(interaction: CommandInteraction) {
    const guild = new Guild(interaction.guildId);
    debug = debug(guild.debug); // set debug status
    setRoles(interaction, guild);
  }
} as Command

/**
 * Set admin role
 * @param {Snowflake} interaction - initating interaction
 * @param {Guild} guild - guild to pull settings from
 */
function setRoles(interaction: CommandInteraction, guild: NilesGuild) {
  const role = interaction.options.getRole("role");
  // add role
  debug(`setRoles | ${guild.id} | set role: ${role}`);
  interaction.reply(i18n.t("admin.set", {lng: guild.lng, role}));
  return guild.setSetting("adminRole", [role]);
}