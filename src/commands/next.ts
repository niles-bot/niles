const { SlashCommandBuilder } = require("@discordjs/builders");
const { DateTime } = require("luxon");
const calendar = require("~/src/handlers/calendar.js");
const { Guild } = require("~/src/handlers/guilds.js");
const { i18n } = require("~/src/handlers/strings.js");
const { errorLog } = require("~/src/handlers/errorLog.js");
let debug = require("~/src/handlers/logger");


module.exports = {
  data: new SlashCommandBuilder()
    .setName("next")
    .setDescription("Next event on calendar"),
  execute(interaction) {
    const guild = new Guild(interaction.guild_id);
    debug = debug(guild.debug);
    nextEvent(interaction, guild);
  }
};

/**
 * Displays the next upcoming event in the calendar file
 * @param {Snowflake} interaction - Interaction to respond to
 * @param {Guild} guild - Guild to get the calendar from
 * @returns {Snowflake} response with confirmation or failiure
 */
function nextEvent(interaction, guild) {
  debug(`nextEvent | ${guild.id}`);
  const now = DateTime.local().setZone(guild.tz);
  calendar.listEvents(guild).then((resp) => {
    if (!resp.data) return; // return if no data
    for (const eventObj of resp.data.items) {
      // create luxon date from dateTime or date
      const luxonDate = DateTime.fromISO(eventObj.start.dateTime || eventObj.start.date);
      if (luxonDate > now) { // make sure event happens in the future
        const relativeTime = `<t:${luxonDate.valueOf()}:R>`;
        // description is passed in - option to be added
        return interaction.reply(i18n.t("next.next", { summary: eventObj.summary, relativeTime, lng: guild.lng }));
      }
    }
    // run if message not sent
    debug(`nextEvent | ${guild.id} | no upcoming`);
    return interaction.reply(i18n.t("next.no_upcoming", {lng: guild.lng }));
  }).catch((err) => { errorLog(err);
  });
}
