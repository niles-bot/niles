const fs = require("fs");
const path = require("path");
const log = require("debug")("niles:sidecar");
const filename = path.join("stores", "todo_list.json");
var list = [];

/**
 * Append guild to list
 * @param {String} guild - guildID to remove
 * @param {String} channel - channelID to send to
 */
function append(guild, channel) {
  list.push({guild: guild, channel: channel});
  write();
}

/**
 * remove guild from list
 * @param {String} guild - guildID to remove
 */
function remove(guild) {
  list = list.filter((item) => item.guild !== guild);
  write();
}

/**
 * Load json file
 */
function load() {
  return JSON.parse(fs.readFileSync(filename, "utf8")).list;
}

/**
 * Write list to file
 */
function write() {
  fs.writeFile(filename, JSON.stringify({list: list}, null, 4), (err) => {
    if (err) console.log(err);
  });
  return false;
}

list = load();
append("123", "4560");
append("12300", "4560");
append("45600", "7890");
write();
//remove("123");
console.log(list);
