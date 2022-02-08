import { SlashCommandBuilder } from "@discordjs/builders";
import { NilesGuild } from "utils/guilds";
import { CommandInteraction } from "discord.js";
import { Command } from "niles/types/command";
import Debug from "debug";
const debug = Debug("niles:cmd");

const commandData = new SlashCommandBuilder()
  .setName("displayoptions")
  .setDescription("Change calendar display options")
  .addSubcommand(sc =>
    sc.setName("calendar")
      .setDescription("Calendar message settings")
      .addStringOption(option => 
        option.setName("style")
          .setDescription("Calendar message style")
          .addChoice("codeblock", "code")
          .addChoice("embed", "embed")
      ).addStringOption(option =>
        option.setName("name")
          .setDescription("Calendar name")
      ).addStringOption(option =>
        option.setName("link")
          .setDescription("Calendar link destination")
      ).addBooleanOption(option =>
        option.setName("pin")
          .setDescription("Pin Calendar")
      )
  ).addSubcommand(sc =>
    sc.setName("days")
      .setDescription("Calendar day options")
      .addIntegerOption(option =>
        option.setName("days")
          .setDescription("Number of days to display")
      ).addBooleanOption(option =>
        option.setName("emptydays")
          .setDescription("Show empty days")
      )
  )

export default {
  data: 
}