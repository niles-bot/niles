// package imports
const debug = require("debug")("niles:helpers");
// module imports
const { i18n } = require("~/handlers/strings.js");

/**
 * This function makes sure that the calendar matches a specified type
 * @param {String} calendarID - calendar ID to classify
 * @param {Snowflake} channel - Channel to send callback to
 * @param {Guild} guild - Guild to pull settings from
 * @returns {bool} - if calendar ID is valid
 */
function matchCalType(calendarID, channel, guild) {
  debug(`matchCalType | id: ${calendarID}`);
  // regex filter groups
  const groupCalId = RegExp("([a-z0-9]{26}@group.calendar.google.com)");
  const cGroupCalId = RegExp("^(c_[a-z0-9]{26}@)");
  const importCalId = RegExp("(^[a-z0-9]{32}@import.calendar.google.com)");
  const gmailAddress = RegExp("^([a-z0-9.]+@gmail.com)");
  const underscoreCalId = RegExp("^[a-z0-9](_[a-z0-9]{26}@)");
  const domainCalId = RegExp("^([a-z0-9.]+_[a-z0-9]{26}@)");
  const domainAddress = RegExp("(^[a-z0-9_.+-]+@[a-z0-9-]+.[a-z0-9-.]+$)");
  // filter through regex
  if (gmailAddress.test(calendarID)) { // matches gmail
  } else if (importCalId.test(calendarID)) { // matches import ID
  } else if (groupCalId.test(calendarID)) {
    if (cGroupCalId.test(calendarID)) { // matches cGroup
    } else if (domainCalId.test(calendarID)) { channel.send(i18n.t("caltype.domain", { lng: guild.lng }));
    } else if (underscoreCalId.test(calendarID)) { channel.send(i18n.t("caltype.underscore", { lng: guild.lng }));
    }
    return true; // normal group id or any variation
  } else if (domainAddress.test(calendarID)) { channel.send(i18n.t("caltype.domain", { lng: guild.lng }));
  } else { return false; // break and return false
  }
  return true; // if did not reach false
}

module.exports = {
  matchCalType
};