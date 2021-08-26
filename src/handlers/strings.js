// package imports
const { join } = require("path");
const i18next = require("i18next");
const SyncBackend = require("i18next-fs-backend");

i18next
  .use(SyncBackend)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    initImmediate: true,
    backend: {
      // for all available options read the backend's repository readme file
      loadPath: join(__dirname, "../translations/{{lng}}.yaml"),
      addPath: join(__dirname, "../translations/missing/{{lng}}.yaml")
    },
    interpolation: {
      escapeValue: false
    },
    debug: false
  });
i18next.loadLanguages(["fr"]);

module.exports = {
  i18n: i18next
};
