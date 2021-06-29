// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const settings = require("~/settings.js");

module.exports = {
  name: "auth",
  description: true,
  preSetup: true,
  usage: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    setAuth(args, guild, message.channel);
  }
};

/**
 * Send message with deletion timeout
 * @param {Snowflake} channel - channel to send message in
 * @param {String} content - content of message
 * @param {Number} [timeout=5000] - time in milliseconds before message is deleted
 */
function send(channel, content, timeout=5000) {
  channel.send(content)
    .then((message) => message.delete({ timeout }));
}

/**
 * Get and store access token after promptiong for user authorization
 * @param {bool} force - force reauthentication
 * @param {Guild} guild - Guild to pull settings from
 * @param {Snowflake} channel - channel to respond and listen to
 */
function getAccessToken(force, guild, channel) {
  debug(`getAccessToken | ${guild.id}`);
  if (!settings.oauth2) { return send(channel, i18n.t("auth.oauth.notinstalled", { lng: guild.lng })); }
  const authUrl = settings.oauth2.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.events"]
  });
  if (guild.getSetting("auth") === "oauth" && !force) {
    debug("getAccessToken | no reauth");
    return send(channel, i18n.t("auth.oauth.reauth", { lng: guild.lng }));
  }
  const authEmbed = {
    color: 0x0099e1,
    description: i18n.t("auth.oauth.prompt", { lng: guild.length, authUrl })
  };
  debug("getAccessToken | send auth embed");
  send(channel, { embed: authEmbed }, 30000 );
  let collector = channel.createMessageCollector((msg) => !msg.author.bot, { time: 30000 });
  collector.on("collect", (m) => {
    settings.oauth2.getToken(m.content, (err, token) => {
      if (err) return send(channel, i18n.t("auth.oauth.err", { lng: guild.lng, err }));
      send(channel, i18n.t("auth.oauth.confirm", { lng: guild.lng }));
      guild.setSetting("auth", "oauth");
      guild.setToken(token);
    });
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") send(channel, i18n.t("collector.timeout", { lng: guild.lng }));
  });
}

/**
 * Guide user through authentication setup
 * @param {[String]} args - Arguments passed in
 * @param {Guild} guild - Guild to pull settings form
 * @param {Snowflake} channel - Channel to respond to
 * @returns {Snowflake} - message response
 */
function setAuth(args, guild, channel) {
  debug(`setAuth | ${guild.id}`);
  if (args[0] === "oauth") {
    if (!settings.oauth2) {
      send(channel, i18n.t("auth.oauth.notinstalled", { lng: guild.lng }));
    }
    getAccessToken((args[1] === "force"), guild, channel);
  } else if (args[0] === "sa") {
    if (!settings.sa) {
      send(channel, i18n.t("auth.sa.notinstalled", { lng: guild.lng }));
    }
    guild.getSetting("auth", "sa");
    send(channel, i18n.t("auth.sa.invite", { lng: guild.lng, saId: settings.saId }), 10000);
  }
}
