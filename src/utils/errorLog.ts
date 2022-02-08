import { secrets } from "niles/settings";
import { WebhookClient } from "discord.js";
const { error_webhook_id, error_webhook_token } = secrets;
const webhookClient = new WebhookClient({ id: error_webhook_id, token: error_webhook_token });
const tripleGrave = "```";

const formatLogMessage = (message: string) => `[${new Date().toUTCString()}] ${message}`;

export const errorLog = (message: string) => {
  const logMessage = formatLogMessage(message);
  webhookClient.send({
    content: tripleGrave+logMessage+tripleGrave,
    username: "error"
  });
  /* eslint-disable-next-line no-console */
  console.error(logMessage);
};
