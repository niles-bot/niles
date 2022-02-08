import Debug from "debug";
const debug = Debug("niles:cmd");
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { checkDiscordAdmin } from "utils/checkDiscordAdmin";
import { db } from "utils/database";
import { errorLog } from "utils/errorLog";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("init")
    .setDescription("Reset Niles settings to default"),
  execute: async (interaction: CommandInteraction) => {
    const id = interaction.guildId;
    debug(`init | ${id}`);
    // check if user has admin permission
    if (!checkDiscordAdmin(interaction)) {
      errorLog(`init | ${id} | user not admin`);
      return interaction.reply(`Sorry, you must be a Server Administrator to use this command.`);
    }
    errorLog(`init | ${id} | success`);
    interaction.reply(`Resetting Niles settings to default`);
    for (const version of ["v1"]) {
      for (const namespace of ["update", "discord", "calendar", "display"]) {
        await db.delete(`${version}_${id}_${namespace}`);
      }
    }
  }
};
