const { readFileSync, writeFileSync, existsSync} = require("fs");
const { join } = require("path");
const log = require("debug")("niles:updater-list");
const filename = join(__dirname, "..", "stores", "todo_list.json");

/**
 * Load json file
 * @returns {[{guild, channel}]} - Array with objects containing guild and chnanel
 */
const load = () => !existsSync(filename) ? [] : JSON.parse(readFileSync(filename, "utf8")).list;

/**
 * Append guild to list
 * @param {String} list 
 */
function write(list) {
  writeFileSync(filename, JSON.stringify({list}, null, 4), (err) => { if (err) console.log(err); });
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
  log(`append ${guild}`);
}

/**
 * remove guild from list
 * @param {String} guild - guildID to remove
 */
function remove(guild) {
  let list = load();
  list = list.filter((item) => item.guild !== guild); // recreate list without target
  write(list);
  log(`remove ${guild}`);
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

module.exports = {
  append,
  remove,
  exists,
  getIterator
};
