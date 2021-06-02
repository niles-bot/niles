// package imports
const debug = require("debug")("niles:cmd");
// module imports
const guilds = require("~/handlers/guilds.js");
const { i18n } = require("~/handler/strings.js");

module.exports = {
  name: "init",
  description: "Reinitialize Guild",
  execute(message, args) {
    args;
    const guild = new guilds.Guild(message.channel.guild.id);
    debug(`init | ${guild.id}`);
    message.channel.send(i18n.t("reset", {lng: guild.lng}));
    guilds.recreateGuild(guild.id);
  }
};