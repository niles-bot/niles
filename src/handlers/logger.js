const consoleDebug = require("debug")("niles:cmd");
const { secrets } = require("~/src/settings.js"); 
const { WebhookClient } = require("discord.js");
const { debug_webhook_id, debug_webhook_token } = secrets;
const webhookClient = new WebhookClient({ id: debug_webhook_id, token: debug_webhook_token });
const tripleGrave = "```";

/**
 * Format log messages with DateTime string
 * [Sun, 10 Sep 2001 00:00:00 GMT]
 * @param {string} message 
 */
const formatLogMessage = (message) => `[${new Date().toUTCString()}] ${message}`;

module.exports = (DEBUGGUILD) => (message) => {
  logger(DEBUGGUILD, message);
};

const logger = (DEBUGGUILD, message) => {
  // split logging into local debu1g and console debug
  const logMessage = formatLogMessage(message);
  if (DEBUGGUILD) {
    webhookClient.send({
      content: tripleGrave+logMessage+tripleGrave,
      username: "debug"
    });
  }
  consoleDebug(logMessage);
};