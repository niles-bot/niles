const debug = require("debug")("niles:cmd");
const { access, constants } = require("fs");
const { secrets } = require("~/settings.js");

module.exports = {
  name: "sudo",
  description: "Niles operator command runner",
  args: true,
  execute(message, args) {
    // check if author is admin
    if (!secrets.admins.includes(message.author.id)) {
      return message.channel.send("Not Admin");
    }
    // run admin command
    const cmd = args.shift();
    debug(`adminCmd | cmd ${cmd} | args: ${args}`);
    if (cmd === "debug") { adminDebug(message.channel, args);
    } else if (cmd === "reload") {
      adminReload(message, args);
    } else {
      message.channel.send("invalid subcommand");
    }
  }
};

/**
 * Sends stores files for specified guild
 * @param {Snowflake} channel - channel to respond to
 * @param {[String]} args - guild ID to pass in
 */
function adminDebug(channel, args) {
  access(`stores/${args[0]}`, constants.F_OK, (err) => {
    if (err) channel.send("Guild ENOENT");
  });
  channel.send({
    content: `debug for guild ${args[0]}`,
    files: [{
      attachment: `stores/${args[0]}/calendar.json`,
      name: "calendar.json"
    }, {
      attachment: `stores/${args[0]}/settings.json`,
      name: "settings.json"
    }]
  });
}

/**
 * Reloads a command
 * @param {Snowflake} message - message to respond to
 * @param {[String]} args - command to reload
 * @returns 
 */
function adminReload(message, args) {
  // check for existing commands
  const commandName = args[0].toLowerCase();
  const command = message.client.commands.get(commandName)
    || message.client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));
  if (!command) {
    return message.channel.send(`There is no command with name or alias \`${commandName}\``);
  }
  // command exists, reload
  delete require.cache[require.resolve(`~/commands/${command.name}.js`)];
  try {
    const newCommand = require(`~/commands/${command.name}.js`);
    message.client.commands.set(newCommand.name, newCommand);
    message.channel.send(`Command \`${newCommand.name}\` was reloaded!`);
  } catch (error) {
    console.error(error);
    message.channel.send(`There was an error while reloading a command \`${command.name}\`:\n\`${error.message}\``);
  }
}
