import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { NilesGuild } from "~/src/utils/guilds";
import { i18n } from "~/src/utils/strings";
import * as settings from "~/src/settings";
import { errorLog } from "~/src/utils/errorLog";
import Debug from "debug";
const debug = Debug("niles:cmd");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("auth")
    .setDescription("authenticate with GCal")
    .addSubcommandGroup((oauth) =>
      oauth
        .setName("oauth")
        .setDescription("Authenticate with Google OAuth")
        .addSubcommand((token) =>
          token
            .setName("get")
            .setDescription("Get access token")
        )
        .addSubcommand((auth) =>
          auth
            .setName("set")
            .setDescription("Set OAuth token")
            .addStringOption((tokenInput) =>
              tokenInput
                .setName("token")
                .setDescription("response from OAuth2")
                .setRequired(true)
            )
        )
    ).addSubcommand((sa) =>
      sa
        .setName("sa")
        .setDescription("Authenticate with Service Account")
    ),
  execute(interaction: CommandInteraction) {
    const guild = new NilesGuild(interaction.guildId);
    auth(interaction, guild);
  }
};

function saAuth(interaction: CommandInteraction, guild: NilesGuild, lng: string) {
  if (!settings.sa) {
    errorLog(`auth sa | ${guild.id} | no SA installed`);
    return interaction.reply(i18n.t("auth.sa.notinstalled", { lng }));
  }
  // guild.set("discord", "auth", "sa");
  interaction.reply(i18n.t("auth.sa.invite", { lng, saId: settings.saId }));
}

/*
function oauthAuth(interaction: CommandInteraction, guild: NilesGuild, lng: string) {
  // return error if no oauth2 installed
  if (!settings.oauth2) {
    errorLog(`auth oauth | ${guild.id} | no OAuth installed`);
    return interaction.reply(i18n.t("auth.oauth.notinstalled", { lng }));
  }
  if (interaction.options.getSubcommand() === "set") {
    debug("getAccessToken | set");
    const tokenResponse = interaction.options.getString("token");
    settings.oauth2.getToken(tokenResponse, (err, token) => {
      if (err) {
        errorLog(`auth oauth | ${guild.id} | invalid response`);
        return interaction.reply(i18n.t("auth.oauth.err", { lng, err }));
      }
      debug(`auth oauth | ${guild.id} | success`);
      guild.setSetting("auth", "oauth");
      guild.setToken(token);
      return interaction.reply(i18n.t("auth.oauth.confirm", { lng }));
    });
  } else if (interaction.options.getSubcommand() === "get") {
    debug("getAccessToken | get");
    const authUrl = settings.oauth2.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/calendar.events"]
    });
    const authEmbed = {
      color: 0x0099e1,
      description: i18n.t("auth.oauth.get", { lng, authUrl })
    };
    return interaction.reply({ embeds: [authEmbed] });
  }
}
*/

function disabledOauth (interaction: CommandInteraction) {
  return interaction.reply("oauth is disabled");
}

async function auth(interaction: CommandInteraction, guild: NilesGuild) {
  debug(`getAccessToken | ${guild.id}`);
  const discordSettings = await guild.get("discord");
  const lng = discordSettings.lng as string;
  saAuth(interaction, guild, lng);
  if (interaction.options.getSubcommand() === "sa") {
    saAuth(interaction, guild, lng);
  } else {
    disabledOauth(interaction);
    //oauthAuth(interaction, guild, lng);
  }
}
