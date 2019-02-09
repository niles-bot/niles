const path = require("path");
const helpers = require("./helpers.js");
const fs = require("fs");
const usersPath = path.join(__dirname, "..", "stores", "users.json");
const users = require("../stores/users.json");
const strings = require("./strings.js");

function permissionDMChanger(message) {
  let pieces = message.content.split(" ");
  if (!pieces[1]) {
    return message.author.send("You didn't enter an argument. Use `!permissions 0`");
  }
  if (pieces[1] && !Number.isInteger(parseInt(pieces[1], 10))) {
    return message.author.send("You can only use a number i.e. `!permissions 0`");
  }
  if (["0", "1"].includes(pieces[1])) {
    let settings = {
      "permissionChecker": pieces[1]
    };
    users[message.author.id] = settings;
    fs.writeFile(usersPath, JSON.stringify(users, "", "\t"), (err) => {
      if (err) {
        return helpers.log("error writing the users database" + err);
      }
    });
    return message.author.send("okay I've changed that setting.");
  }
  return message.author.send("I didn't change anything, use `!permissions 0` or `!permissions 1`");
}

function run(message) {
  const cmd = message.content.toLowerCase().substring(1).split(" ")[0];
  //Command to function mappings
  let help = () => message.author.send(strings.HELP_MESSAGE);
  let permissions = () => permissionDMChanger(message);
  let cmdFns = {
    permissions,
    help
  };
  let cmdFn = cmdFns[cmd];
  if (cmdFn) {
    cmdFn();
  }
  if (message.content === "help") {
    message.author.send(strings.HELP_MESSAGE);
  }
}

module.exports = {
  run
};
