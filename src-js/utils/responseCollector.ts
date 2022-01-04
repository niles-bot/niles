// package imports
const defer = require("promise-defer");
const debug = require("debug")("niles:helpers");
// module imports
const { i18n } = require("./strings.js");

/**
 * Collects response for a message
 * @param {Snowflake} channel - Channel to create collector in
 * @param {String} lng - locale of response
 */
function responseCollector(channel, lng) {
  debug(`responseCollector | ${channel.guild.id}`);
  let p = defer();
  const collector = channel.createMessageCollector((msg) => !msg.author.bot, { time: 30000 });
  collector.on("collect", (m) => {
    if (["y", "yes"].includes(m.content.toLowerCase())) { p.resolve();
    } else {
      channel.send(i18n.t("collector.reject", { lng }));
      p.reject();
    }
    collector.stop();
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") return channel.send(i18n.t("collector.timeout", { lng }));
  });
  return p.promise;
}

module.exports = {
  responseCollector
};
