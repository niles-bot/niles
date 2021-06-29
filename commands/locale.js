// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { responseCollector } = require("~/handlers/responseCollector.js");

module.exports = {
  name: "locale",
  description: true,
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    setLocale(message.channel, args, guild);
  }
};

/**
 * Set guild Locale
 * @param {Channel} channel - callback channel
 * @param {[String]} args - passed in arguments 
 * @param {Guild} guild - Guild to pull or change settings for 
 */
function setLocale(channel, args, guild) {
  debug(`setLocale | ${guild.id}`);
  const currentLocale = guild.getSetting("lng");
  const locale = args[0];
  const localeRegex = new RegExp("[a-zA-Z]{2}$");
  if (!locale) { // no input
    channel.send(`The current locale is ${currentLocale} for date formatting and ${i18n.t("language", {lng: currentLocale})} for text.`);
  } else if (localeRegex.test(locale)) { // passes validation
    channel.send(`I've been setup to use ${currentLocale}, do you want to overwrite this and use ${locale}? (Please see https://nilesbot.com/locale for details) **(y/n)**`);
    responseCollector(channel, "en").then(() => {
      debug(`setLocale | ${guild.id} | set to locale: ${locale}`);
      return guild.setSetting("lng", locale);
    }).catch((err) => { discordLog(err); });
  // fails validation
  } else {
    debug(`setLocale | ${guild.id} | failed validation: ${locale}`);
    channel.send("Invalid locale, please only use an ISO 3166-1 alpha2 (https://mchang.icu/niles/locale) code");
  }
}
