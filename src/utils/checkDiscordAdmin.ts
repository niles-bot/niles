import { CommandInteraction, Permissions } from "discord.js";

export const checkDiscordAdmin = (interaction: CommandInteraction) => {
  const needed = Permissions.FLAGS.ADMINISTRATOR;
  const permissions = interaction.member.permissions as Readonly<Permissions>;
  return permissions.has(needed);
};
