const fs = require("fs");
const path = require("path");
let settings = require("../settings.js");
let bot = require("../bot.js");

function log() {
    let message = `[${new Date()}] ${Array.from(arguments).join(" ")}`;
    console.log(message);
}

function logError() {
    log("[ERROR]", Array.from(arguments).slice(1).join(" "));
}

function readFile(path) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
}

function fullname(user) {
  return `${user.username}#${user.discriminator}`;
}

function deleteFolderRecursive(path) {
  if( fs.existsSync(path) ) {
      fs.readdirSync(path).forEach(function(file,index){
        var curPath = path + "/" + file;
        if(fs.lstatSync(curPath).isDirectory()) {
            deleteFolderRecursive(curPath);
        } else {
            fs.unlinkSync(curPath);
          }
      });
      fs.rmdirSync(path);
  }
}

function writeGuilddb(guilddb) {
    let guilddatabase = path.join(__dirname, "..", "stores/guilddatabase.json");
    fs.writeFile(guilddatabase, JSON.stringify(guilddb, "","\t"), (err) => {
      if(err) {
          return logError("error writing the guild database" + err);
      }
    });
}

function writeGuildSpecific(guildid, json, file) {
    let fullPath = path.join(__dirname,"..", "stores", guildid, file + ".json");
    fs.writeFile(fullPath, JSON.stringify(json, "", "\t"), (err) => {
        if(err) {
            return logError("error writing guild specific database: " + err);
        }
    });
}

function mentioned(msg, x) {
    if(!Array.isArray(x)) {
        x = [x];
    }
    return msg.isMentioned(bot.client.user.id) && x.some((c) => msg.content.toLowerCase().includes(c));
}

function hourString(hour) {
    let hours = ["12","1","2","3","4","5","6","7","8","9","10","11","12","1","2","3","4","5","6","7","8","9","10","11"];
    return hours[hour];
}

function dayString(number) {
    let days = ["Sunday","Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[number];
}

function monthString(number) {
    let months = ["January", "February", "March", "April","May", "June", "July","August","September","October","November","December"];
    return months[number];
}

function firstUpper(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function prependZero(item) {
    let converted = "";
    if (String(item).length<2) {
        converted = "0" + String(item);
        return converted;
    }
    else {
        return String(item);
    }
}

function convertDate(dateToConvert, guildid) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", guildid, "settings.json");
    let guildSettings = readFile(guildSettingsPath);
    let tz = guildSettings["timezone"];
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
    let nd = new Date(utc + (3600000*offset));
    return nd;
}

function stringDate(date, guildid, hour) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", guildid, "settings.json");
    let guildSettings = readFile(guildSettingsPath);
    let offset = guildSettings["timezone"].split("+")[1];
    let year = date.getFullYear();
    let month = prependZero(date.getMonth() + 1);
    let day = prependZero(date.getDate());
    let dateString = "";
    if (hour === "start") {
        dateString += `${year}-${month}-${day}T00:00:00+${offset}`;
    }
    if (hour === "end") {
        dateString += `${year}-${month}-${day}T23:59:00+${offset}`;
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
    }
    else {
        if (hour <= 11) {
            return `${hourString(parseInt(date.getHours(),10))}:${minutes}AM`;
        }
        if (hour > 11) {
            return `${hourString(parseInt(date.getHours(),10))}:${minutes}PM`;
        }
    }
}

module.exports = {
    fullname,
    deleteFolderRecursive,
    writeGuilddb,
    writeGuildSpecific,
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
    prependZero
};
