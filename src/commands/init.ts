import Debug from "debug";
const debug = Debug("niles:cmd");
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { i18n } from "~/src/utils/strings";
import { checkAdmin } from "~/src/utils/checkAdmin";
import { db } from "~/src/utils/database";
import { NilesGuild } from "~/src/utils/guilds";
import { errorLog } from "~/src/utils/errorLog";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("init")
    .setDescription("Reset Niles settings to default"),
  async execute (interaction: CommandInteraction) {
    const id = interaction.guildId;
    debug(`init | ${id}`);
    const guild = new NilesGuild(id);
    const discordSettings = await guild.get("discord");
    const lng = discordSettings.lng as string;
    // check if user has admin permission
    if (!checkAdmin(interaction)) {
      errorLog(`init | ${id} | user not admin`);
      return interaction.reply(i18n.t("cmd.noperm"));
    }
    errorLog(`init | ${id} | success`);
    interaction.reply(i18n.t("reset", { lng }));
    for (const version of ["v1"]) {
      for (const namespace of ["update", "discord", "calendar", "display"]) {
        db.delete(`${version}_${id}_${namespace}`);
      }
    }
  }
};
