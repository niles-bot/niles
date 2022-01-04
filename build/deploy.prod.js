const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const { readdirSync } = require("fs");
require("dotenv").config();

const { BOT_TOKEN: token, BOT_CLIENT_ID: clientId } = process.env;

const commands = readdirSync("./dist/commands")
  .filter((file) => file.endsWith(".js"))
  .map((file) => require(`./dist/commands/${file}`).default.data.toJSON());

const rest = new REST({ version: "9" }).setToken(token);

(async () => {
  try {
    console.log("Started deploying slash commands globally.");

    await rest.put(Routes.applicationCommands(clientId), {
      body: commands
    });

    console.log("Successfully deployed slash commands globally.");
  } catch (error) {
    console.error(error);
  }
})();