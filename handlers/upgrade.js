const fs = require("fs");
const { join } = require("path");

const folders = fs.readdirSync("~/stores");
folders.forEach((file) => {
  const folderPath = join(__dirname, "..", "stores", file);
  if (fs.statSync(folderPath).isDirectory()) {
    const fileName = join(folderPath, "settings.json");
    const data = JSON.parse(fs.readFileSync(fileName), "utf8");
    const version = data?.version || 0;
  }
});

/**
 * Convert v0/v1 settings to v2
 * @param {string} fileName - The file name of the settings.json
 */
function v1to2 (fileName) {
  const currentData = JSON.parse(fs.readFileSync(fileName, "utf8"));
  let newData = {
    version: 2,
    lng: currentData.lng,
    prefix: currentData.prefix,
    allowedRoles: currentData.allowedRoles,
    calendars: {
      default: {
        calendarID: [currentData.calendarID],
        timezone: currentData.timezone,
        helpmenu: Number(currentData.helpmenu),
        format: currentData.format,
        tzDisplay: Number(currentData.tzDisplay),
        emptydays: Number(currentData.emptydays),
        showpast: Number(currentData.showpast),
        trim: currentData.trim,
        days: currentData.days,
        style: currentData.style,
        inline: Number(currentData.inline),
        description: Number(currentData.description)
      }
    }
  };
  fs.writeFileSync(fileName, JSON.stringify(newData, null, 2));
}