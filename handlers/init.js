const path = require("path");
const helpers = require("./helpers.js");
const guilds = require("./guilds.js");
const strings = require("./strings.js");
const bot = require("../bot.js");

/**
 * Write Settings
 * @param {String} channelid - callback channel
 * @param {String} value - Value to write
 * @param {String} setting - Setting name to write to
 */
function writeSetting(channelid, value, setting) {
  const channel = bot.client.channels.cache.get(channelid);
  const guildid = channel.guild.id;
  const guildSettingsPath = path.join(__dirname, "..", "stores", guildid, "settings.json");
  let guildSettings = helpers.readFile(guildSettingsPath);
  guildSettings[setting] = value;
  channel.send(`Okay, the value for this server's \`${setting}\` setting has been changed to \`${value}\``);
  helpers.writeGuildSpecific(guildid, guildSettings, "settings");
}

/**
 * set guild calendar id
 * @param {String} channelid - ID of callback channel 
 * @param {[String]} args - command arguments
 * @param {Object} guildSettings - settings for guild
 */
function logId(channelid, args, guildSettings) {
  const channel = bot.client.channels.cache.get(channelid);
  const calendarId = args[0];
  const guildCalendarId = guildSettings.calendarID;
  if (!calendarId) {
    if (guildCalendarId) {
      channel.send(`You didn't enter a calendar ID, you are currently using \`${guildCalendarId}\``);
    } else {
      channel.send("Enter a calendar ID using `!id`, i.e. `!id 123abc@123abc.com`");
    }
    return;
  }
  else if (!helpers.matchCalType(calendarId, channelid)) {
    return channel.send("I don't think that's a valid calendar ID... try again");
  } else if (guildCalendarId !== "") {
    channel.send(`I've already been setup to use \`${guildCalendarId}\` as the calendar ID in this server, do you want to overwrite this and set the ID to \`${calendarId}\`? **(y/n)**"`);
    helpers.yesThenCollector(channelid).then(() => {
      writeSetting(channelid, calendarId, "calendarID");
    }).catch((err) => {
      helpers.log(err);
    });
  } else {
    writeSetting(channelid, calendarId, "calendarID");
  }
}

/**
 * set guild tz
 * @param {String} channelid - ID of callback channel 
 * @param {[String]} args - arguments passed in 
 * @param {Object} guildSettings - guild settings to modify
 */
function logTz(channelid, args, guildSettings) {
  const channel = bot.client.channels.cache.get(channelid);
  const currentTz = guildSettings.timezone;
  let tz = args[0];
  if (!tz) { // no input
    if (!currentTz) { // no timezone set
      return channel.send("Enter a timezone using `!tz`, i.e. `!tz America/New_York` or `!tz UTC+4` or `!tz EST` No spaces in formatting.");
    } else { // timezone set
      return channel.send(`You didn't enter a timezone, you are currently using \`${currentTz}\``);
    }
  }
  // valid input
  if (helpers.validateTz(tz)) { // passes validation
    if (currentTz) { // timezone set
      channel.send(`I've already been setup to use \`${currentTz}\`, do you want to overwrite this and use \`${tz}\`? **(y/n)**`);
      helpers.yesThenCollector(channel.id).then(() => { // collect yes
        writeSetting(channelid, tz, "timezone");
      }).catch((err) => {
        helpers.log(err);
      });
    } else { // timezone is not set
      writeSetting(channelid, tz, "timezone");
    }
  } else { // fails validation
    return channel.send("Enter a timezone in valid format `!tz`, i.e. `!tz America/New_York` or `!tz UTC+4` or `!tz EST` No spaces in formatting.");
  }
}

/**
 * Sets guild prefix
 * @param {String} channelid - ID of callback channel 
 * @param {[String]} args - arguments passed in
 * @param {Object} guildSettings - current guild settings
 */
function setPrefix(channelid, args, guildSettings) {
  const channel = bot.client.channels.cache.get(channelid);
  const newPrefix = args[0];
  if (!newPrefix) {
    return channel.send(`You are currently using \`${guildSettings.prefix}\` as the prefix. To change the prefix use \`!prefix <newprefix>\` or \`@Niles prefix <newprefix>\``);
  } else if (newPrefix) {
    channel.send(`Do you want to set the prefix to \`${newPrefix}\` ? **(y/n)**`);
    helpers.yesThenCollector(channel.id).then(() => {
      writeSetting(channelid, newPrefix, "prefix");
    }).catch((err) => {
      helpers.log(err);
    });
  }
}

/**
 * Set admin role
 * @param {Snowflake} message 
 * @param {[String]} args 
 * @param {Object} guildSettings 
 */
function setRoles(message, args, guildSettings) {
  const adminRole = args[0];
  const channelid = message.channel.id;
  const allowedRoles = guildSettings.allowedRoles;
  const userRoles = message.member.roles.cache.map((role) => role.name);
  if (!adminRole && allowedRoles.length === 0) {
    return message.channel.send(strings.RESTRICT_ROLE_MESSAGE);
  } else if (!adminRole) {
    return message.channel.send(`The admin role for this discord is \`${allowedRoles}\`. You can change this setting using \`${guildSettings.prefix}admin <ROLE>\`, making sure to spell the role as you've created it. You must have this role to set it as the admin role.\n You can allow everyone to use Niles again by entering \`${guildSettings.prefix}admin everyone\``);
  } else if (adminRole) {
    if (adminRole.toLowerCase() === "everyone") {
      message.channel.send("Do you want to allow everyone in this channel/server to use Niles? **(y/n)**");
      helpers.yesThenCollector(channelid).then(() => {
        writeSetting(channelid, [], "allowedRoles");
      }).catch((err) => {
        helpers.log(err);
      });
    } else if (!userRoles.includes(adminRole)) {
      return message.channel.send("You do not have the role you're trying to assign. Remember that adding Roles is case-sensitive");
    } else {
      message.channel.send(`Do you want to restrict the use of the calendar to people with the \`${adminRole}\`? **(y/n)**`);
      helpers.yesThenCollector(channelid).then(() => {
        writeSetting(channelid, [adminRole], "allowedRoles");
      }).catch((err) => {
        helpers.log(err);
      });
    }
  }
}

/**
 * Runs commands
 * @param {Snowflake} message - Initiating Message
 */
exports.run = function(message) {
  let guildSettings = helpers.getGuildSettings(message.guild.id, "settings");
  const args = message.content.slice(guildSettings.prefix.length).trim().split(" ");
  // if mentioned return second object as command, if not - return first object as command
  let cmd = (message.mentions.has(bot.client.user.id) ? args.splice(0, 2)[1] : args.shift());
  cmd = cmd.toLowerCase();
  const channelid = message.channel.id;
  // command parsers
  if (["setup"].includes(cmd)) {
    message.channel.send(strings.SETUP_MESSAGE);
  } else if (["id"].includes(cmd)) {
    logId(channelid, args, guildSettings);
  } else if (["tz"].includes(cmd)) {
    logTz(channelid, args, guildSettings);
  } else if (["init"].includes(cmd)) {
    guilds.recreateGuild(message.guild);
  } else if (["prefix"].includes(cmd)) {
    setPrefix(channelid, args, guildSettings);
  } else if (["admin"].includes(cmd)) {
    setRoles(message, args, guildSettings);
  } else if (["help"].includes(cmd)) {
    message.channel.send(strings.SETUP_HELP);
  } else if (bot.isValidCmd(message)) {
    message.channel.send("You haven't finished setting up! Try `!setup` for details on how to start.");
  }
};
