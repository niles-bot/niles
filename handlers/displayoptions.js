const log = require("debug")("niles:do");
const { i18n } = require("./strings.js");

/**
 * Send message with deletion timeout
 * @param {Snowflake} channel - channel to send message in
 * @param {String} content - content of message
 * @param {Number} [timeout=5000] - time in milliseconds before message is deleted
 */
function send(channel, content, timeout=5000) {
  channel.send(content)
    .then((message) => {
      message.delete({ timeout });
    });
}

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
    choices: [12, 24],
    type: "binaryChoiceInt"
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
 * @returns {String} response to user
 */
function doBinary(value, guild, setting) {
  log(`doBinary | ${guild.id} | setting: ${setting} | value: ${value}`);
  const help = i18n.t(`displayoptions.binary.${setting}`);
  if (value === "1" || value === "0") {
    guild.setSetting(setting, value); // set value
    return i18n.t(`displayoptions.binary.${(value === "1" ? "confirmOn" : "confirmOff")}`, { help, lng: guild.lng });
  } else {
    return i18n.t("displayoptions.badarg.binary", { lng: guild.lng, help });
  }
}

/**
 * handle binary embed display options
 * @param {String} value - value passed in
 * @param {Guild} guild - Guild object 
 * @param {String} setting - setting name
 * @returns {String} response to user
 */
function doBinaryEmbed(value, guild, setting) {
  const curStyle = guild.getSetting("style");
  log(`doBinaryEmbed | ${guild.id} | setting: ${setting} | value: ${value} | style: ${curStyle}`);
  // if set to code, do not allow
  if (curStyle === "embed") return doBinary(value, guild, setting);
  else return i18n.t("displayoptions.embedonly", { lng: guild.lng });
}

/**
 * handle string choice display options
 * @param {String} value - value passed in
 * @param {Guild} guild - Guild object 
 * @param {Object} settingObj - setting to change
 * @returns {String} response to user
 */
function doChoice(value, guild, settingObj) {
  const setting = settingObj.name;
  log(`doChoice | ${guild.id} | setting: ${setting} | value: ${value}`);
  if (settingObj.choices.includes(value)) {
    const help = i18n.t(`displayoptions.choice.${setting}`);
    guild.setSetting(setting, value);
    return i18n.t("displayoptions.choice.confirm", { lng: guild.lng, help, value });
  } else {
    return i18n.t(`displayoptions.badarg.${setting}`);
  }
}

/**
 * Handle integer choice display options
 * @param {Integer} value - value passed in 
 * @param {Guild} guild - Guild object
 * @param {Object} settingObj - settingsObj object
 * @returns {String} response to user
 */
function doInt(value, guild, settingObj) {
  const name = settingObj.name;
  log(`doInt | ${guild.id} | setting: ${name} | value: ${value}`);
  if (value) {
    const valueInt = parseInt(value);
    const help = i18n.t(`displayoptions.choice.${name}`);
    const setValue =
      isNaN(valueInt) ? settingObj.default
        : valueInt > settingObj.max ? settingObj.max
          : valueInt;
    guild.setSetting(name, setValue);
    return i18n.t("displayoptions.choice.confirm", { lng: guild.lng, help, value: setValue });
  } else {
    return i18n.t(`displayoptions.badarg.${name}`);
  }
}

/**
 * Handle all displayoptions and pass to respective handlers
 * @param {[String]} args - arguemnts passed in
 * @param {Guild} guild - Guild object that called command
 * @param {Snowflake} channel - Channel that called command
 * @returns {String} response to user
 */
function doHandler(args, guild, channel) {
  const setting = args[0];
  const value = args[1];
  // if not found return help
  if (!( setting in doHelpArray)) return send(channel, i18n.t("displayoptions.help", { lng: guild.lng }));
  const settingObj = doHelpArray[setting];
  const settingName = settingObj.name;
  let prompt;
  switch (settingObj.type) {
  case "binaryNumber":
    prompt = doBinary(value, guild, settingName);
    break;
  case "binaryChoice":
    prompt = doChoice(value, guild, settingObj);
    break;
  case "binaryChoiceInt":
    prompt = doChoice(parseInt(value), guild, settingObj);
    break;
  case "binaryEmbed":
    prompt = doBinaryEmbed(value, guild, settingName);
    break;
  case "int":
    prompt = doInt(value, guild, settingObj);
    break;
  }
  send (channel, prompt);
}

module.exports = {
  doHandler
};
