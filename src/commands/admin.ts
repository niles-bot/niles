const { SlashCommandBuilder } = require("@discordjs/builders");
const { Guild } = require("~/src/handlers/guilds.js");
const { i18n } = require("~/src/handlers/strings.js");
let debug = require("~/src/handlers/logger");


module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Set allowed role")
    .addRoleOption((option) => 
      option.setName("role")
        .setDescription("Role to allow to interact with Niles")),
  execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    debug = debug(guild.debug); // set debug status
    setRoles(interaction, guild);
  }
};

/**
 * Set admin role
 * @param {Snowflake} interaction - initating interaction
 * @param {Guild} guild - guild to pull settings from
 */
function setRoles(interaction, guild) {
  const role = interaction.options.getRole("role");
  // add role
  debug(`setRoles | ${guild.id} | set role: ${role}`);
  interaction.reply(i18n.t("admin.set", {lng: guild.lng, role}));
  return guild.setSetting("allowedRoles", [role]);
}