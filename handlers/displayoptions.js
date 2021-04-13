const log = require("debug")("niles:do");
const strings = require("./strings.js");
const { send } = require("./comamnds.js");

const doHelpArray = {
  pin: {
    name: "pin",
    type: "binaryNumber"
  }, tzdisplay: {
    name: "tzDisplay",
    type: "binaryNumber"
  }, emptydays: {
    name: "emptydays",
    type: "binaryNumber"
  }, showpast: {
    name: "showpast",
    type: "binaryNumber"
  }, help: {
    name: "helpmenu",
    type: "binaryNumber"
  }, startonly: {
    name: "startonly",
    type: "binaryNumber"
  }, inline: {
    name: "inline",
    type: "binaryEmbed"
  }, description: {
    name: "description",
    type: "binaryEmbed"
  }, url: {
    name: "url",
    type: "binaryEmbed"
  }, eventtime: {
    name: "eventtime",
    type: "binaryNumber"
  }, format: {
    name: "format",
    choices: ["12", "24"],
    type: "binaryChoice"
  }, style: {
    name: "style",
    choices: ["code", "embed"],
    type: "binaryChoice"
  }, trim: {
    name: "trim",
    type: "int",
    default: 0
  }, desclength: {
    name: "descLength",
    type: "int",
    default: 0
  }, days: {
    name: "days",
    type: "int",
    default: 7,
    max: 25
  }
};

/**
 * handle binary display options
 * @param {String} value - value passed in
 * @param {Guild} guild - Guild object 
 * @param {String} setting - setting name
 * @returns {String} callback string
 */
function doBinary(value, guild, setting) {
  log(`doBinary | ${guild.id} | setting: ${setting} | value: ${value}`);
  const help = strings.i18n.t(`displayoptions.binary.${setting}`);
  if (value) {
    guild.setSetting(setting, value); // set value
    return strings.i18n.t(`displayoptions.binary.${(value === "1" ? "confirmOn" : "confirmOff")}`);
  } else {
    return strings.i18n.t("displayoptions.binary.prompt", { lng: guild.lng, help });
  }
}

/**
 * handle binary embed display options
 * @param {String} value - value passed in
 * @param {Guild} guild - Guild object 
 * @param {String} setting - setting name
 * @returns {String} callback string
 */
function doBinaryEmbed(value, guild, setting) {
  const curStyle = guild.getSetting("style");
  const help = strings.i18n.t(`displayoptions.binary.${setting}`);
  log(`doBinaryEmbed | ${guild.id} | setting: ${setting} | value: ${value} | style: ${curStyle}`);
  // if set to code, do not allow
  if (value) {
    guild.setSetting(setting, value); // set value
    return strings.i18n.t(
      (value === "1" ? "displayoptions.binary.confirmOn"
        : "displayoptions.binary.confirmOff"),
      { help, lng: guild.lng});
  } else {
    return strings.i18n.t("displayoptions.badarg.binary", { lng: guild.lng, help });
  }
}

/**
 * handle string choice display options
 * @param {String} value - value passed in
 * @param {Guild} guild - Guild object 
 * @param {Object} settingObj - setting to change
 * @returns {String} setting name
 */
function doChoice(value, guild, settingObj) {
  const setting = settingObj.name;
  log(`doChoice | ${guild.id} | setting: ${setting} | value: ${value}`);
  if (settingObj.choices.includes(value)) {
    const help = strings.i18n.t(`displayoptions.choice.${setting}`);
    guild.setSetting(setting, value);
    return strings.i18n.t("displayoptions.choice.confirm", { lng: guild.lng, help, value });
  } else {
    return strings.i18n.t(`displayoptions.badarg.${setting}`);
  }
}

/**
 * Handle integer choice display options
 * @param {Integer} value - value passed in 
 * @param {Guild} guild - Guild object
 * @param {Object} settingObj - settingsObj object
 * @returns 
 */
function doInt(value, guild, settingObj) {
  log(`doInt | ${guild.id} | setting: ${settingObj.name} | value: ${value}`);
  if (value) {
    const help = strings.i18n.t(`displayoptions.choice.${settingObj.help}`);
    const setValue =
      isNaN(value) ? settingObj.default
        : value > settingObj.max ? settingObj.max
          : value;
    guild.setSetting(settingObj.name, setValue);
    return strings.i18n.t("displayoptions.choice.confirm", { lng: guild.lng, help, value });
  } else {
    return strings.i18n.t(`displayoptions.badarg.${settingObj.name}`);
  }
}

/**
 * Handle all displayoptions and pass to respective handlers
 * @param {[String]} args - arguemnts passed in
 * @param {Guild} guild - Guild object that called command
 * @param {Snowflake} channel - Channel that called command
 * @returns 
 */
function doHandler(args, guild, channel) {
  const setting = args[0];
  const value = args[1];
  // find setting
  if (!( setting in doHelpArray)) return send(channel, strings.i18n.t("displayoptions.help", { lng: guild.lng }));
  const settingObj = doHelpArray[setting];
  const settingName = settingObj.name;
  if (settingObj.type === "binaryNumber") {
    send(channel, doBinary(value, guild, settingName));
  } else if (settingObj.type === "binaryChoice") {
    send(channel, doChoice(value, guild, settingObj));
  } else if (settingObj.type === "binaryEmbed") {
    send(channel, doBinaryEmbed(value, guild, settingName));
  } else if (settingObj.type ===  "int") {
    const valueInt = parseInt(value);
    send(channel, doInt(valueInt, guild, settingObj));
  }
}

module.exports = {
  doHandler
};
