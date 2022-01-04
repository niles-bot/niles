const { SlashCommandBuilder } = require("@discordjs/builders");
const { Guild } = require("~/src/handlers/guilds.js");
const { i18n } = require("~/src/handlers/strings.js");
const settings = require("~/src/settings.js");
const { errorLog } = require("~/src/handlers/errorLog.js");
let debug = require("~/src/handlers/logger");

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
  execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    debug = debug(guild.debug);
    getAccessToken(interaction, guild);
  }
};

/**
 * Respond with service account invite
 * @param {Guild} guild - Guild to pull settings form
 * @param {Snowflake} interaction - Interaction to respond to
 * @returns {Snowflake} - message response
 */
function saAuth(interaction, guild) {
  if (!settings.sa) {
    errorLog(`auth sa | ${guild.id} | no SA installed`);
    return interaction.reply(i18n.t("auth.sa.notinstalled", { lng: guild.lng }));
  }
  guild.setSetting("auth", "sa");
  interaction.reply(i18n.t("auth.sa.invite", { lng: guild.lng, saId: settings.saId }));
}

/**
 * Handle OAuth2 authentication
 * @param {Snowflake} interaction - Interaction to respond to
 * @param {Guild} guild - Guild to pull settings form
 * @returns {Snowflake} - message response
 */
function oauthAuth(interaction, guild) {
  // return error if no oauth2 installed
  if (!settings.oauth2) {
    errorLog(`auth oauth | ${guild.id} | no OAuth installed`);
    return interaction.reply(i18n.t("auth.oauth.notinstalled", { lng: guild.lng }));
  }
  if (interaction.options.getSubcommand() === "set") {
    debug("getAccessToken | set");
    const tokenResponse = interaction.options.getStringOption("token");
    settings.oauth2.getToken(tokenResponse, (err, token) => {
      if (err) {
        errorLog(`auth oauth | ${guild.id} | invalid response`);
        return interaction.reply(i18n.t("auth.oauth.err", { lng: guild.lng, err }));
      }
      debug(`auth oauth | ${guild.id} | success`);
      guild.setSetting("auth", "oauth");
      guild.setToken(token);
      return interaction.reply(i18n.t("auth.oauth.confirm", { lng: guild.lng }));
    });
  } else if (interaction.options.getSubcommand() === "get") {
    debug("getAccessToken | get");
    const authUrl = settings.oauth2.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/calendar.events"]
    });
    const authEmbed = {
      color: 0x0099e1,
      description: i18n.t("auth.oauth.get", { lng: guild.length, authUrl })
    };
    return interaction.reply({ embeds: [authEmbed] });
  }
}

/**
 * Get and store access token after prompting for user authorization
 * @param {bool} force - force reauthentication
 * @param {Guild} guild - Guild to pull settings from
 * @param {Snowflake} channel - channel to respond and listen to
 */
function getAccessToken(interaction, guild) {
  debug(`getAccessToken | ${guild.id}`);
  if (interaction.options.getSubcommand() === "sa") {
    saAuth(interaction, guild);
  } else {
    oauthAuth(interaction, guild);
  }
}