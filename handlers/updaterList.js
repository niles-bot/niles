// imports
const { readFileSync, writeFileSync} = require("fs");
const { join } = require("path");
// define todo_list
const filename = join("..", "stores", "todo_list.json");

/**
 * Load json file
 * @returns {[{guild, channel}]} - Array with objects containing guild and chnanel
 */
const load = () => JSON.parse(readFileSync(filename, "utf8")).list;

/**
 * Append guild to list
 * @param {String} guild - guildID to remove
 * @param {String} channel - channelID to send to
 */
function append(guild, channel) {
  let list = load();
  list.push({guild: guild, channel: channel});
  write(list);
}

/**
 * remove guild from list
 * @param {String} guild - guildID to remove
 */
function remove(guild) {
  let list = load();
  // recreate list without target
  list = list.filter((item) => item.guild !== guild);
  write(list);
}

/**
 * Write list to file
 */
function write(list) {
  writeFileSync(filename, JSON.stringify({list}, null, 4), (err) => {
    if (err) console.log(err);
  });
}

/**
 * Load iterator from array
 * @returns {Iterator} - Iterator 
 */
const getIterator = () => load()[Symbol.iterator]();

module.exports = {
  append,
  remove,
  getIterator
};
