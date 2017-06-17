const fs = require("fs");
const path = require("path");
let settings = require("../settings.js")

exports.fullname = function(user) {
  return `${user.username}#${user.discriminator}`;
}

exports.deleteFolderRecursive = function(path) {
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
};

exports.writeGuilddb = function writeGuilddb(guilddb) {
    let guilddatabase = path.join(__dirname, "..", "stores/guilddatabase.json");
    fs.writeFile(guilddatabase, JSON.stringify(guilddb, '','\t'), (err) => {
      if(err) {
          return console.log(Date() + ' error writing the guild database' + err);
      }
    });
}

exports.writeGuildSpecific = function(guildid, json, file) {
    let fullPath = path.join(__dirname,"..", "stores", guildid, file + ".json");
    fs.writeFile(fullPath, JSON.stringify(json, '', '\t'), (err) => {
        if(err) {
            return console.log(Date() + "error writing guild specific database: " + err);
        }
    });
}

exports.mentioned = function(msg, x) {
    if(!Array.isArray(x)) {
        x = [x];
    }
    return msg.isMentioned(client.user.id) && x.some((c) => msg.content.toLowerCase().includes(c));
}

exports.dayString = function(number) {
    let days = ['Sunday','Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[number];
}

exports.monthString = function(number) {
    let months = ['January', 'February', 'March', 'April','May', 'June', 'July','August','September','October','November','December'];
    return months[number];
}

exports.hourString = function(hour) {
    let hours = ['12','1','2','3','4','5','6','7','8','9','10','11','12','1','2','3','4','5','6','7','8','9','10','11'];
    return hours[hour];
}

function hourString(hour) {
    let hours = ['12','1','2','3','4','5','6','7','8','9','10','11','12','1','2','3','4','5','6','7','8','9','10','11'];
    return hours[hour];
}

exports.hourStringSuffix = function(hour) {
    let hours = ['12 AM:','1 AM:','2 AM:','3 AM:','4 AM:','5 AM:','6 AM:','7 AM:','8 AM:','9 AM:',
    '10 AM:','11 AM:','12 PM:','1 PM:','2 PM:','3 PM:','4 PM:','5 PM:','6 PM:','7 PM:','8 PM:','9 PM:','10 PM:','11 PM:'];
    return hours[hour];
}

exports.firstUpper = function(string) {
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

exports.prependZero = function(item)  {
    let converted = "";
    if (String(item).length<2) {
        converted = "0" + String(item);
        return converted;
      }
      else {
        return String(item);
      }
}

exports.convertDate = function(dateToConvert, guildid) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", guildid, "settings.json");
    let guildSettings = require(guildSettingsPath);
    let tz = guildSettings["timezone"];
    let pieces = tz.split("GMT")[1];
    let hour = pieces.split(':')[0];
    let minutes = pieces.split(':')[1];
    if (minutes == '00') {
        minutes = ".";
    }
    if (minutes == "30") {
        minutes = ".5";
    };
    let offset = parseFloat(hour + minutes);
    let utc = dateToConvert.getTime() + (dateToConvert.getTimezoneOffset() * 60000);
    let utcdate = new Date(utc);
    let nd = new Date(utc + (3600000*offset));
    return nd;
}

exports.stringDate = function(date, guildid, hour) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", guildid, "settings.json");
    let guildSettings = require(guildSettingsPath);
    let offset = guildSettings["timezone"].split('+')[1];
    let year = date.getFullYear();
    let month = prependZero(date.getMonth() + 1);
    let day = prependZero(date.getDate());
    let dateString = '';
    if (hour === 'start') {
        dateString += `${year}-${month}-${day}T00:00:00+${offset}`;
    }
    if (hour === 'end') {
        dateString += `${year}-${month}-${day}T23:59:00+${offset}`;
    }
    return dateString;
}

exports.getStringTime = function (date) {
    let hour = date.getHours();
    let minutes = prependZero(date.getMinutes());
    if (minutes == '00') {
        if (hour <= 11) {
            return hourString(parseInt(date.getHours())) + 'AM';
        }
        if (hour > 11) {
            return hourString(parseInt(date.getHours())) + 'PM';
        }
    }
    else {
        if (hour <= 11) {
            return `${hourString(parseInt(date.getHours()))}:${minutes}AM`;
        }
        if (hour > 11) {
            return `${hourString(parseInt(date.getHours()))}:${minutes}PM`;
        }
    }
}
