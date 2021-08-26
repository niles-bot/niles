const { secrets } = require("~/src/settings.js"); 
const { WebhookClient } = require("discord.js");
const { error_webhook_id, error_webhook_token } = secrets;
const webhookClient = new WebhookClient({ id: error_webhook_id, token: error_webhook_token });
const tripleGrave = "```";

/**
 * Format log messages with DateTime string
 * [Sun, 10 Sep 2001 00:00:00 GMT]
 * @param {string} message 
 */
const formatLogMessage = (message) => `[${new Date().toUTCString()}] ${message}`;

exports.errorLog = (message) => {
  const logMessage = formatLogMessage(message);
  webhookClient.send({
    content: tripleGrave+logMessage+tripleGrave,
    username: "error"
  });
  console.error(logMessage);
};