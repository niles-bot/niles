// package imports
const discord = require("discord.js");
// module import
const { i18n } = require("~/handlers/strings.js");

const generateCalendarFields (eventsArr, options) {
  let fields = [];
  let msgLength = 0;
  eventsArr.forEach(day => {
    // day level
    // skip empty days if not supposed to display
    if (!day && !options.display.emptydays) continue;
    let fieldObj = {
      name: "**" + dayMap[i].toLocaleString({ weekday: "long", locale: guild.lng })
        + "** - " + dayMap[i].toLocaleString({ month: "long", day: "2-digit", locale: guild.lng }),
      inline: options.display.inline
    }
    let dayString = "\u200b";
    day.forEach(event => {
      dayString += formatEvent(event, options)
    })
  })
}

function formatEvent (event, options) {
  const duration = createDurationString(event, guild);
  const eventTitle = createEventName(event, guildSettings); // add link if there is a location
  let eventString = (options.display.eventtime ? `**${duration}** | ${eventTitle}\n`: `${eventTitle}\n`);
  // limit description length
  const descLength = options.display.discription;
  const eventDescription = event.description;
  // if we should add description
  if ((eventDescription) && (options.display.description)) {
    eventString += `\`${(descLength
      ? eventDescription.slice(0, descLength)
      : eventDescription)}\`\n`;
  }
  return eventString;
}


/**
 * Generate Calendar embed
 * @param {*} events 
 * @param {*} options 
 * @returns 
 */
function generateCalendar(events, options) {
  let embed = new discord.MessageEmbed();
  embed.setTitle(options.calendarName)
    .setURL("https://calendar.google.com/calendar/embed?src=" + options.calendarID)
    .setColor("BLUE")
    .setFooter("Last update")
    .setTimestamp();
  if (!events) {
    embed.setDescription("```No Upcoming Events```");
  }
  // add help message
  if (options.display.help) {
    embed.addField(
      i18n.t("calendar.embed.help_title", { lng: options.lng }),
      i18n.t("calendar.embed.help_desc", { lng: options.lng })
      , false);
  }
  // display timezone
  if (options.display.timezone) {
    embed.addField("Timezone", options.timezone, false);
  }
  return embed;
}