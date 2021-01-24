const helpers = require("./helpers.js");
const guilds = require("./guilds.js");
const strings = require("./strings.js");
const bot = require("../bot.js");

/**
 * set guild calendar id
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - command arguments
 * @param {Guild} guild - Guild to change ID for
 */
function logId(channel, args, guild) {
  const calendarId = args[0];
  const oldID = guild.getSetting("calendarID");
  if (!calendarId) {
    if (oldID) channel.send(`You didn't enter a calendar ID, you are currently using \`${oldID}\``);
    else channel.send("Enter a calendar ID using `!id`, i.e. `!id 123abc@123abc.com`");
  }
  else if (!helpers.matchCalType(calendarId, channel)) {
    channel.send("I don't think that's a valid calendar ID... try again");
  } else if (oldID !== "") {
    channel.send(`I've already been setup to use \`${oldID}\` as the calendar ID in this server, do you want to overwrite this and set the ID to \`${calendarId}\`? **(y/n)**"`);
    helpers.yesThenCollector(channel).then(() => {
      guild.setSetting("calendarID", calendarId);
      return null;
    }).catch((err) => {
      helpers.log(err);
    });
  } else {
    guild.setSetting("calendarID", calendarId);
  }
}

/**
 * set guild tz
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - arguments passed in 
 * @param {Guild} guild - Guild getter to change settings for
 */
function logTz(channel, args, guild) {
  const currentTz = guild.getSetting("timezone");
  const tz = args[0];
  if (!tz) { // no input
    if (!currentTz) { // no timezone set
      channel.send("Enter a timezone using `!tz`, i.e. `!tz America/New_York` or `!tz UTC+4` or `!tz EST` No spaces in formatting.");
    } else { // timezone set
      channel.send(`You didn't enter a timezone, you are currently using \`${currentTz}\``);
    }
  }
  // valid input
  else if (helpers.validateTz(tz)) { // passes validation
    if (currentTz) { // timezone set
      channel.send(`I've already been setup to use \`${currentTz}\`, do you want to overwrite this and use \`${tz}\`? **(y/n)**`);
      helpers.yesThenCollector(channel).then(() => { // collect yes
        guild.setSetting("timezone", tz);
        return null;
      }).catch((err) => {
        helpers.log(err);
      });
    } else { // timezone is not set
      guild.setSetting("timezone", tz);
    }
  } else { // fails validation
    channel.send("Enter a timezone in valid format `!tz`, i.e. `!tz America/New_York` or `!tz UTC+4` or `!tz EST` No spaces in formatting.");
  }
}

/**
 * Sets guild prefix
 * @param {Snowflake} channel - Callback channel 
 * @param {[String]} args - arguments passed in
 * @param {Guild} guild - Guild to change prefix for
 */
function setPrefix(channel, args, guild) {
  const newPrefix = args[0];
  if (!newPrefix) {
    channel.send(`You are currently using \`${guild.prefix}\` as the prefix. To change the prefix use \`${guild.prefix}prefix <newprefix>\` or \`@Niles prefix <newprefix>\``);
  } else if (newPrefix) {
    channel.send(`Do you want to set the prefix to \`${newPrefix}\` ? **(y/n)**`);
    helpers.yesThenCollector(channel).then(() => {
      guild.setSetting("prefix", newPrefix);
      return null;
    }).catch((err) => {
      helpers.log(err);
    });
  }
}

/**
 * Set admin role
 * @param {Snowflake} message - initating message
 * @param {[String]} args - arguments from command
 * @param {Guild} guild - guild to pull settings from
 */
function setRoles(message, args, guild) {
  const adminRole = args[0];
  const allowedRoles = guild.getSetting("allowedRoles");
  const userRoles = message.member.roles.cache.map((role) => role.name);
  let roleArray;
  if (!adminRole) {
    if (allowedRoles.length === 0) return message.channel.send(strings.RESTRICT_ROLE_MESSAGE);
    message.channel.send(`The admin role for this discord is \`${allowedRoles}\`. You can change this setting using \`${guild.prefix}admin <ROLE>\`, making sure to spell the role as you've created it. You must have this role to set it as the admin role.\n You can allow everyone to use Niles again by entering \`${guild.prefix}admin everyone\``);
  } else if (adminRole) {
    if (adminRole.toLowerCase() === "everyone") {
      message.channel.send("Do you want to allow everyone in this channel/server to use Niles? **(y/n)**");
      roleArray = [];
    } else if (!userRoles.includes(adminRole)) {
      message.channel.send("You do not have the role you're trying to assign. Remember that adding Roles is case-sensitive");
    } else {
      message.channel.send(`Do you want to restrict the use of the calendar to people with the \`${adminRole}\`? **(y/n)**`);
      roleArray = [adminRole];
    }
    helpers.yesThenCollector(message.channel).then(() => {
      guild.setSetting("allowedRoles", roleArray);
      return null;
    }).catch((err) => {
      helpers.log(err);
    });
  }
}

/**
 * Runs commands
 * @param {Snowflake} message - Initiating Message
 */
exports.run = function(message) {
  const guild = new helpers.Guild(message.guild.id);
  const args = message.content.slice(guild.prefix.length).trim().split(" ");
  // if mentioned return second object as command, if not - return first object as command
  let cmd = (message.mentions.has(bot.client.user.id) ? args.splice(0, 2)[1] : args.shift());
  cmd = cmd.toLowerCase();
  const channel = message.channel;
  // command parsers
  if (["setup"].includes(cmd)) {
    message.channel.send(strings.SETUP_MESSAGE);
  } else if (["id"].includes(cmd)) {
    logId(channel, args, guild);
  } else if (["tz"].includes(cmd)) {
    logTz(channel, args, guild);
  } else if (["init"].includes(cmd)) {
    guilds.recreateGuild(message.guild);
  } else if (["prefix"].includes(cmd)) {
    setPrefix(channel, args, guild);
  } else if (["admin"].includes(cmd)) {
    setRoles(message, args, guild);
  } else if (["help"].includes(cmd)) {
    message.channel.send(strings.SETUP_HELP);
  } else if (bot.isValidCmd(message)) {
    message.channel.send("You haven't finished setting up! Try `!setup` for details on how to start.");
  }
};
