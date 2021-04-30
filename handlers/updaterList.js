const { readFileSync, writeFileSync} = require("fs");
const { join, basename } = require("path");
const log = require("debug")("updater-list");
// it ran by bot, do not go to upper directory
const entry = basename(require.main.filename);
console.log("===ENTRYPOINT===");
console.log(entry);
const filename = join("stores", "todo_list.json");

//const filename = (entry === "commands.js") ? join("..", "stores", "todo_list.json") : join("stores", "todo_list.json");

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
 * Append guild to list
 * @param {String} list 
 */
function write(list) {
  writeFileSync(filename, JSON.stringify({list}, null, 4), (err) => { if (err) console.log(err); });
}

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
