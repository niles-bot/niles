const { join } = require("path");
const i18next = require("i18next");
const SyncBackend = require("i18next-fs-backend");

i18next
  .use(SyncBackend)
  .init({
    languages: ["en", "fr"],
    fallbackLng: "en",
    initImmediate: false,
    backend: {
      // for all available options read the backend's repository readme file
      loadPath: join(__dirname, "../translations/{{lng}}.yaml")
    },
    interpolation: {
      escapeValue: false
    }
  });

module.exports = {
  i18n: i18next
};
