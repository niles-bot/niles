// package imports
const debug = require("debug")("niles:helpers");

/**
 * This function makes sure that the calendar matches a specified type
 * @param {String} calendarID - calendar ID to classify
 * @returns {bool} - if calendar ID is valid
 */
exports.matchCalType = (calendarID) => {
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
  return gmailAddress.test(calendarID) || importCalId.test(calendarID) ||
    groupCalId.test(calendarID) || cGroupCalId.test(calendarID) ||
    domainCalId.test(calendarID) || underscoreCalId.test(calendarID) ||
    domainAddress.test(calendarID);
};