// package imports
const { readFileSync, writeFileSync, existsSync} = require("fs");
const { join } = require("path");
const debug = require("debug")("niles:updater-list");
// module imports
const { discordLog } = require("~/handlers/discordLog.js");
// const
const FILENAME = join(__dirname, "..", "stores", "todo_list.json");

/**
 * Load json file
 * @returns {[{guild, channel}]} - Array with objects containing guild and chnanel
 */
const load = () => !existsSync(FILENAME) ? [] : JSON.parse(readFileSync(FILENAME, "utf8")).list;

/**
 * Append guild to list
 * @param {String} list 
 */
function write(list) {
  writeFileSync(FILENAME, JSON.stringify({list}, null, 4), (err) => { if (err) console.log(err); });
}

/**
 * Append guild to list
 * @param {String} guild - guildID to remove
 * @param {String} channel - channelID to send to
 */
function append(guild, channel) {
  let list = load();
  list.push({guild, channel});
  write(list);
  debug(`append ${guild}`);
}

/**
 * remove guild from list
 * @param {String} guild - guildID to remove
 */
function remove(guild) {
  let list = load();
  list = list.filter((item) => item.guild !== guild); // recreate list without target
  write(list);
  debug(`remove ${guild}`);
}

/**
 * check if guild exists
 * @param {String} guild 
 */
const exists = (guild) => load().some((obj) => obj.guild === guild);

/**
 * Load iterator from array
 * @returns {Iterator} - Iterator 
 */
const getIterator = () => load()[Symbol.iterator]();

/**
 * Safely deletes update timer
 * @param {String} guildID - guild to remove from timers
 * @param {String} reason - reason for removal
 */
function killUpdateTimer (guildID, reason = "none") {
  remove(guildID);
  const message = `removed ${guildID} | ${reason}`;
  discordLog(message);
  console.error(message);
}

/**
 * Start update timer for guild mentioned
 * @param {String} guildID - ID of guild to update
 * @param {String} channelid - ID of channel to callback to
 */
function startUpdateTimer(guildID, channelid) {
  if (exists(guildID)) {
    debug(`startUpdateTimer | ${guildID} | updater exists exists`);
    return discordLog(`timer not started in guild: ${guildID}`);
  } else {
    debug(`startUpdateTimer | ${guildID} | no current updater`);
    discordLog(`Starting update timer in guild: ${guildID}`);
    append(guildID, channelid);
  }
}

module.exports = {
  exists,
  getIterator,
  killUpdateTimer,
  startUpdateTimer
};
