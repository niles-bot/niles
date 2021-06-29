const prefix = "!";
const { i18n } = require("~/handlers/strings.js");
const { Guild } = require("~/handlers/guilds.js");

module.exports = {
  name: "help",
  description: "List all of my commands or info about a specific command.",
  aliases: ["commands"],
  usage: "[command name]",
  execute(message, args) {
    const guild = Guild(message.guild);
    const data = [];
    const { commands } = message.client;

    if (!args.length) {
      data.push("Here's a list of all my commands:");
      data.push(commands.map((command) => command.name).join(", "));
      data.push(`\nYou can send \`${prefix}help [command name]\` to get info on a specific command!`);
    
      return message.author.send(data, { split: true })
        .then(() => {
          if (message.channel.type === "dm") return;
          message.reply("I've sent you a DM with all my commands!");
        })
        .catch((error) => {
          console.error(`Could not send help DM to ${message.author.tag}.\n`, error);
          message.reply("it seems like I can't DM you! Do you have DMs disabled?");
        });
    }
    const name = args[0].toLowerCase();
    const command = commands.get(name) || commands.find((c) => c.aliases && c.aliases.includes(name));

    if (!command) {
      return message.reply("that's not a valid command!");
    }

    data.push(`**Name:** ${command.name}`);

    if (command.aliases) data.push(`**Aliases:** ${command.aliases.join(", ")}`);
    if (command.description) data.push("`**Description:**" + i18n.t(`help.admin.${command.name}.description`, { lng: guild.lng }));
    if (command.usage) data.push(`**Usage:** ${prefix}${command.name} ${i18n.t(`help.${command.name}.usage`)}`);

    message.channel.send(data, { split: true });
  }
};