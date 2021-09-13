const { readFileSync, writeFileSync, existsSync} = require("fs");
const { join } = require("path");
const log = require("debug")("niles:deny-list");
const filename = join(__dirname, "..", "stores", "deny_list.json");

/**
 * Load json file
 * @returns {String[]} - Array with objects containing guild and chnanel
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
 * Append calID to list
 * @param {String} calID - calID to blacklist
 */
function append(calID) {
  let list = load();
  list.push(calID);
  write(list);
  log(`append ${calID}`);
}

/**
 * remove guild from list
 * @param {String} calID - calID to remove
 */
function remove(calID) {
  let list = load();
  list.splice(list.indexOf(calID), 1); // recreate list without target
  write(list);
  log(`remove ${calID}`);
}

/**
 * check if guild exists
 * @param {String} guild 
 */
const exists = (calID) => (load().indexOf(calID) !== -1);

module.exports = {
  append,
  remove,
  exists
};
