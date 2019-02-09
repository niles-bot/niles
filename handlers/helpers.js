const fs = require("fs");
const path = require("path");
const defer = require("promise-defer");
let settings = require("../settings.js");
let bot = require("../bot.js");
let minimumPermissions = settings.secrets.minimumPermissions;

function getSettings() {
  return require("../settings.js");
}

function getLogChannel() {
  return bot.client.channels.get(getSettings().secrets.log_discord_channel);
}

function formatLogMessage(message) {
  return `[${new Date().toUTCString()}] ${message}`;
}

function log(...logItems) {
  const logMessage = logItems.join(" ");
  const logString = formatLogMessage(logMessage);
  const tripleGrave = "```";
  const logChannel = getLogChannel();
  if (logChannel) {
    logChannel.send(tripleGrave + logString + tripleGrave);
  } else {
    console.log("no log channel found");
  }
  console.log(logString);
}

function logError() {
  log("[ERROR]", Array.from(arguments).slice(1).join(" "));
}

function readFile(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (err) {
    return log("error reading file " + err);
  }
}

function readFileSettingsDefault(filePath, defaultValue) {
  try {
    const fileData = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileData);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }

    fs.writeFileSync(filePath, defaultValue, {
      encoding: "utf8",
      flag: "wx"
    });
    return JSON.parse(defaultValue);
  }
}

function fullname(user) {
  return `${user.username}#${user.discriminator}`;
}

const guildDatabasePath = path.join(__dirname, "..", "stores", "guilddatabase.json");
let guildDatabase;

function getGuildDatabase() {
  guildDatabase = guildDatabase || readFile(guildDatabasePath);
  return guildDatabase;
}

function writeGuildDatabase() {
  const formattedJson = JSON.stringify(guildDatabase, "", "\t");
  fs.writeFile(guildDatabasePath, formattedJson, (err) => {
    if (!err) {
      return;
    }
    return logError("writing the guild database", err);
  });
}

function amendGuildDatabase(partialGuildDb) {
  Object.assign(guildDatabase, partialGuildDb);
  writeGuildDatabase();
}

function removeGuildFromDatabase(guildId) {
  delete guildDatabase[guildId];
  writeGuildDatabase();
}

function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

function writeGuildSpecific(guildid, json, file) {
  let fullPath = path.join(__dirname, "..", "stores", guildid, file + ".json");
  fs.writeFile(fullPath, JSON.stringify(json, "", "\t"), (err) => {
    if (err) {
      return log("error writing guild specific database: " + err);
    }
  });
}

const userStorePath = path.join(__dirname, "..", "stores", "users.json");
const users = readFileSettingsDefault(userStorePath, "{}");

const userDefaults = {};

//uses cached version of user database
function amendUserSettings(userId, partialSettings) {
  users[userId] = Object.assign({}, users[userId], partialSettings);

  const formattedJson = JSON.stringify(users, "", "\t");
  fs.writeFile(userStorePath, formattedJson, (err) => {
    if (!err) {
      return;
    }
    return logError("writing the users database", err);
  });
}

function getUserSetting(userId, settingName) {
  const apparentSettings = Object.assing({}, userDefaults, users[userId]);
  return apparentSettings[settingName];
}


function mentioned(msg, x) {
  if (!Array.isArray(x)) {
    x = [x];
  }
  return msg.isMentioned(bot.client.user.id) && x.some((c) => msg.content.toLowerCase().includes(c));
}

function hourString(hour) {
  let hours = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
  return hours[hour];
}

function dayString(number) {
  let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[number];
}

function monthString(number) {
  let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[number];
}

function firstUpper(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function prependZero(item) {
  let converted = "";
  if (String(item).length < 2) {
    converted = "0" + String(item);
    return converted;
  } else {
    return String(item);
  }
}

function convertDate(dateToConvert, guildid) {
  let guildSettingsPath = path.join(__dirname, "..", "stores", guildid, "settings.json");
  let guildSettings = readFile(guildSettingsPath);
  let tz = guildSettings.timezone;
  let pieces = tz.split("GMT")[1];
  let hour = pieces.split(":")[0];
  let minutes = pieces.split(":")[1];
  if (minutes === "00") {
    minutes = ".";
  }
  if (minutes === "30") {
    minutes = ".5";
  }
  let offset = parseFloat(hour + minutes);
  let utc = dateToConvert.getTime() + (dateToConvert.getTimezoneOffset() * 60000);
  let utcdate = new Date(utc);
  let nd = new Date(utc + (3600000 * offset));
  return nd;
}

function stringDate(date, guildid, hour) {
  let guildSettingsPath = path.join(__dirname, "..", "stores", guildid, "settings.json");
  let guildSettings = readFile(guildSettingsPath);
  let offset;
  if (guildSettings.timezone.indexOf("-") === -1) {
    offset = guildSettings.timezone.split("+")[1];
  } else {
    offset = guildSettings.timezone.split("-")[1];
  }
  let year = date.getFullYear();
  let month = prependZero(date.getMonth() + 1);
  let day = prependZero(date.getDate());
  let dateString = "";
  if (guildSettings.timezone.indexOf("-") === -1) {
    if (hour === "start") {
      dateString += `${year}-${month}-${day}T00:00:00+${offset}`;
    }
    if (hour === "end") {
      dateString += `${year}-${month}-${day}T23:59:00+${offset}`;
    }
  } else {
    if (hour === "start") {
      dateString += `${year}-${month}-${day}T00:00:00-${offset}`;
    }
    if (hour === "end") {
      dateString += `${year}-${month}-${day}T23:59:00-${offset}`;
    }
  }
  return dateString;
}

function getStringTime(date) {
  let hour = date.getHours();
  let minutes = prependZero(date.getMinutes());
  if (minutes === "00") {
    if (hour <= 11) {
      return hourString(parseInt(date.getHours(), 10)) + "AM";
    }
    if (hour > 11) {
      return hourString(parseInt(date.getHours(), 10)) + "PM";
    }
  } else {
    if (hour <= 11) {
      return `${hourString(parseInt(date.getHours(),10))}:${minutes}AM`;
    }
    if (hour > 11) {
      return `${hourString(parseInt(date.getHours(),10))}:${minutes}PM`;
    }
  }
}


function sendMessageHandler(message, err) {
  if (err.message === "Missing Permissions") {
    return message.author.send("Oh no! I don't have the right permissions in the channel you're trying to use me in! Toggle on all of the 'text permissions' for the **Niles** role");
  } else {
    return log(err);
  }
}

function checkRole(message) {
  let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
  let guildSettings = readFile(guildSettingsPath);
  let userRoles = message.member.roles.map((role) => role.name);
  if (guildSettings.allowedRoles.length === 0) {
    return true;
  }
  if (guildSettings.allowedRoles.length > 0) {
    if (userRoles.includes(guildSettings.allowedRoles[0])) {
      return true;
    } else {
      return false;
    }
  }
}

function checkPermissions(message) {
  let botPermissions = message.channel.permissionsFor(bot.client.user).serialize(true);
  let missingPermissions = "";
  minimumPermissions.forEach(function(permission) {
    if (!botPermissions[permission]) {
      missingPermissions += "\n" + String(permission);
    }
  });
  if (missingPermissions !== "") {
    return false;
  }
  return true;
}

function checkPermissionsManual(message, cmd) {
  let botPermissions = message.channel.permissionsFor(bot.client.user).serialize(true);
  let missingPermissions = "";
  minimumPermissions.forEach(function(permission) {
    if (!botPermissions[permission]) {
      missingPermissions += "\n" + String(permission);
    }
  });
  if (missingPermissions !== "") {
    return message.author.send(`Hey I noticed you tried to use the command \`\`${cmd}\`\`. I am missing the following permissions in channel **${message.channel.name}**: \`\`\`` + missingPermissions + "```" + "\nIf you want to stop getting these DMs type `!permissions 0` in this DM chat.");
  }
  return message.author.send(`I have all the permissions I need in channel **${message.channel.name}**`);
}

function yesThenCollector(message) {
  let p = defer();
  const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, {
    time: 30000
  });
  collector.on("collect", (m) => {
    if (["y", "yes"].includes(m.content.toLowerCase())) {
      p.resolve();
    } else {
      message.channel.send("Okay, I won't do that");
      p.reject();
    }
    collector.stop();
  });
  collector.on("end", (collected, reason) => {
    if (reason === "time") {
      return message.channel.send("Command response timeout");
    }
  });
  return p.promise;
}

module.exports = {
  fullname,
  deleteFolderRecursive,
  getGuildDatabase,
  removeGuildFromDatabase,
  writeGuildDatabase,
  amendGuildDatabase,
  writeGuildSpecific,
  amendUserSettings,
  getUserSetting,
  mentioned,
  dayString,
  monthString,
  firstUpper,
  log,
  logError,
  readFile,
  getStringTime,
  stringDate,
  hourString,
  convertDate,
  prependZero,
  sendMessageHandler,
  checkPermissions,
  checkPermissionsManual,
  checkRole,
  yesThenCollector
};
