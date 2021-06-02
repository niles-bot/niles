// package imports
const debug = require("debug")("niles:cmd");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
const { Guild } = require("~/handlers/guilds.js");
const { i18n } = require("~/handlers/strings.js");
const { responseCollector } = require("~/handlers/responseCollector.js");

module.exports = {
  name: "admin",
  description: "Restrict the usage of Niles to a specific server role",
  execute(message, args) {
    const guild = new Guild(message.channel.guild.id);
    setRoles(message.channel, args, guild);
  }
};

/**
 * Set admin role
 * @param {Snowflake} message - initating message
 * @param {[String]} args - arguments from command
 * @param {Guild} guild - guild to pull settings from
 */
function setRoles(message, args, guild) {
  debug(`setRoles | ${guild.id}`);
  const adminRole = args.join(" ");
  const allowedRoles = guild.getSetting("allowedRoles");
  const userRoles = message.member.roles.cache.map((role) => role.name);
  const lng = guild.lng;
  let roleArray;
  if (!adminRole) {
    // no argument defined
    if (allowedRoles.length === 0) return message.channel.send(i18n.t("admin.noarg", {lng}));
    // admin role exists
    message.channel.send(i18n.t("collector.exist", { name: "$t(adminrole)", lng, old: allowedRoles}));
  } else if (adminRole) {
    // add everyone
    if (adminRole.toLowerCase() === "everyone") {
      debug(`setRoles | ${guild.id} | prompt everyone`);
      message.channel.send(i18n.t("admin.prompt_everyone", {lng}));
      roleArray = [];
    // no role selected
    } else if (!userRoles.includes(adminRole)) {
      debug(`setRoles | ${guild.id} | do not have role`);
      message.channel.send(i18n.t("admin.no_role", {lng}));
    } else {
      // restricting succeeded
      debug(`setRoles | ${guild.id} | prompt role: ${adminRole}`);
      message.channel.send(i18n.t("admin.prompt", {lng, adminRole}));
      roleArray = [adminRole];
    }
    // prompt for confirmation
    responseCollector(message.channel, guild.lng).then(() => {
      message.channel.send(i18n.t("admin.confirm", { lng, adminRole}));
      return guild.setSetting("allowedRoles", roleArray);
    }).catch((err) => { discordLog(err); });
  }
}
