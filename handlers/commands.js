const fs = require("fs");
const path = require("path");
const defer = require("promise-defer");
const CalendarAPI = require("node-google-calendar");
const columnify = require("columnify");
const os = require("os");
const moment = require("moment");
require("moment-duration-format");
let bot = require("../bot.js");
let settings = require("../settings.js");
let init = require("./init.js");
let helpers = require("./helpers.js");
let guilds = require("./guilds.js");
let cal = new CalendarAPI(settings.calendarConfig);
let autoUpdater = [];
const HELP_MESSAGE = "```\
        Niles Usage\n\
---------------------------\n\
!display             -  Display your calendar\n\
!update / !sync      -  Update the Calendar\n\
!create / !scrim     -  Create events using GCal's default interpreter - works best like !scrim xeno June 5 8pm - 9pm\n\
!delete              -  Delete an event using the form !delete Friday 8pm, ONLY works like this !delete <day> <starttime>\n\
!clean / !purge      -  Deletes messages in current channel, either !clean or !clean <number>\n\
!stats / !info       -  Display list of statistics and information about the Niles bot\n\
!invite              -  Get the invite link for Niles to join your server!\n\
!setup               -  Get details on how to setup Niles\n\
!id                  -  Set the Google calendar ID for the guild\n\
!tz                  -  Set the timezone for the guild\n\
!prefix              -  View or change the prefix for Niles\n\
!help                -  Display this message\n\
```\
Visit http://niles.seanecoffey.com for more info.";
const NO_CALENDAR_MESSAGE = "I can't seem to find your calendar! This is usually because you haven't invited Niles to access your calendar, run `!setup` to make sure you followed Step 1.\n\
You should also check that you have entered the correct calendar id using `!id`.\n\
\nIf you are still getting this error join the Discord support server here: https://discord.gg/jNyntBn";
exports.helpmessage = HELP_MESSAGE;

//functions

function clean(channel, numberMessages, recurse) {
    let calendarPath = path.join(__dirname, "..", "stores", channel.guild.id, "calendar.json");
    let calendar = helpers.readFile(calendarPath);
    channel.fetchMessages({ limit: numberMessages}).then((messages) => { //If the current calendar is deleted
        messages.forEach(function(message) {
            if(message.id === calendar["calendarMessageId"]) {
                calendar["calendarMessageId"] = "";
                helpers.writeGuildSpecific(channel.guild.id, calendar, "calendar");
                clearInterval(autoUpdater[channel.guild.id]);
            }
        });
        if(messages.size < 2) {
            channel.send("cleaning"); //Send extra message to allow deletion of 1 message.
            clean(channel, 2, false);
        }
        if(messages.size === 100 && recurse) {
            channel.bulkDelete(messages).catch((err) => {
                helpers.log("clean error in guild " + channel.guild.id + err);
            });
            clean(channel, 100, true);
        }
        else {
            channel.bulkDelete(messages).catch((err) => {
                helpers.log("clean error in guild " + channel.guild.id + err);
            });
        }
    }).catch((err) => {
        helpers.log("function clean in guild:" + channel.guild.id + ":" + err);
    });
}

function deleteMessages(message) {
    let pieces = message.content.split(" ");
    let numberMessages = 0;
    let recurse = false;
    if (pieces[1] && !Number.isInteger(parseInt(pieces[1],10))) {
        message.channel.send("You can only use a number to delete messages. i.e. `!clean 10`");
        return;
    }
    if(parseInt(pieces[1],10) > 0 && parseInt(pieces[1],10) < 100 ) {
        message.channel.send("**WARNING** - This will delete " + pieces[1] + " messages in this channel! Are you sure? **(y/n)**");
        numberMessages = parseInt(pieces[1],10);
    }
    if(parseInt(pieces[1],10) === 100) {
        message.channel.send("**WARNING** - This will delete 100 messages in this channel! Are you sure? **(y/n)**");
        numberMessages = 97;
    }
    if(!pieces[1]) {
        message.channel.send("**WARNING** - This will delete all messages in this channel! Are you sure? **(y/n)**");
        numberMessages = 97;
        recurse = true;
    }
    const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, {time: 30000});
    collector.on("collect", (m) => {
        if(m.content.toLowerCase() === "y" || m.content.toLowerCase() === "yes") {
            clean(message.channel, numberMessages + 3, recurse);
        }
        else {
            message.channel.send("Okay, I won't do that.");
            clean(message.channel, 4, false);
        }
        return collector.stop();
    });
    collector.on("end", (collected, reason) => {
        if (reason === "time") {
            message.channel.send("Command response timeout");
            clean(message.channel, 3, 0);
        }
    });
}

function createDayMap(message) {
    let dayMap = [];
    let d = new Date();
    let nd = helpers.convertDate(d, message.guild.id);
    dayMap[0] = new Date(String(nd));
    for (let i = 1; i < 7; i++) {
        dayMap[i] = new Date(nd.setDate(nd.getDate() + 1));
    }
    return dayMap;
}

function checkDateMatch (date1, date2) {
    return (date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate())
}

function getEvents(message, calendarID, dayMap) {
    let calendarPath = path.join(__dirname, "..", "stores", message.guild.id, "calendar.json");
    let calendar = helpers.readFile(calendarPath);
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    let events = [];
    let tz = guildSettings["timezone"];
    let startDate = helpers.stringDate(dayMap[0], message.guild.id, "start");
    let endDate = helpers.stringDate(dayMap[6], message.guild.id, "end");
    let params = {
        timeMin:startDate,
        timeMax:endDate,
        singleEvents: true,
        orderBy: "startTime"
        };
    cal.Events.list(calendarID, params).then((json) => {
        for(let i = 0; i < json.length; i++) {
            let event = {
                id: json[i].id,
                summary: json[i].summary,
                start: json[i].start,
                end: json[i].end
            };
            events.push(event);
        }
        for(let day = 0; day < 7; day++) {
            let key = "day" + String(day);
            let matches = [];
            for (let j = 0; j < json.length; j++) {
                let tempDate = new Date(events[j]["start"]["dateTime"]);
                tempDate = helpers.convertDate(tempDate, message.guild.id);
                if (checkDateMatch(dayMap[day], tempDate)) {
                    matches.push(events[j]);
                }
                if (events[j]["start"]["date"]) {
                    let allDayEvent = new Date(events[j]["start"]["date"]);
                    if (checkDateMatch(dayMap[day], allDayEvent)) {
                        matches.push(events[j]);
                    }
                }
            }
            calendar[key] = matches;
        }
        let d = new Date();
        calendar["lastUpdate"] = d;
        helpers.writeGuildSpecific(message.guild.id, calendar, "calendar");
    }).catch((err) => {
        if(err.message.includes("notFound")) {
            helpers.log("function getEvents error in guild: " + message.guild.id + " : 404 error can't find calendar");
            message.channel.send(NO_CALENDAR_MESSAGE);
            clearInterval(autoUpdater[message.guild.id]);
            return;
        }
        //Catching periodic google rejections;
        if (err.message.includes("Invalid Credentials")) {
            return helpers.log("function getEvents error in guild: " + message.guild.id + " : 401 invalid credentials");
        }
        else {
            helpers.log("function getEvents error in guild: " + message.guild.id + " : " + err);
            clearInterval(autoUpdater[message.guild.id]);
        }
    });
}

function generateCalendar (message, dayMap) {
    let calendarPath = path.join(__dirname, "..", "stores", message.guild.id, "calendar.json");
    let calendar = helpers.readFile(calendarPath);
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    let p = defer();
    let finalString = "";
    for (let i = 0; i < 7; i++) {
        let key = "day" + String(i);
        let sendString = "";
        sendString += `\n **${helpers.dayString(dayMap[i].getDay())}** - ${helpers.monthString(dayMap[i].getMonth())} ${dayMap[i].getDate()} \n`;
        if (calendar[key].length === 0) {
            sendString += "``` ```";
        }
        else {
            sendString += "```";
            // Map events for each day
            for (let m = 0; m < calendar[key].length; m++) {
                let options = {
                    showHeaders: false,
                    columnSplitter: " | ",
                    columns: ["time", "events"],
                    config: {
                        time: {minWidth: 17, align: "center"},
                        events: {minWidth: 20}
                    }
                };
                let tempString = {};
                let tempStartDate = new Date(calendar[key][m]["start"]["dateTime"]);
                tempStartDate = helpers.convertDate(tempStartDate, message.guild.id);
                let tempFinDate = new Date(calendar[key][m]["end"]["dateTime"]);
                tempFinDate = helpers.convertDate(tempFinDate, message.guild.id);
                tempString[helpers.getStringTime(tempStartDate) + " - " + helpers.getStringTime(tempFinDate)] = calendar[key][m]["summary"];
                sendString += columnify(tempString, options) + "\n";
            }
            sendString += "```";
        }
        finalString += sendString;
    }
    let embed = new bot.discord.RichEmbed();
    embed.setTitle("CALENDAR");
    embed.setURL("https://calendar.google.com/calendar/embed?src=" + guildSettings["calendarID"]);
    embed.setColor("BLUE");
    embed.setDescription(finalString);
    embed.setFooter("Last update");
    if (guildSettings["helpmenu"] === "1") {
      embed.addField("USING THIS CALENDAR", "To create events use ``!create`` or ``!scrim`` followed by your event details i.e. ``!scrim xeno on monday at 8pm-10pm``\n\nTo delete events use``!delete <day> <start time>`` i.e. ``!delete monday 5pm``\n\nHide this message using ``!displayoptions help 0``\n\nEnter ``!help`` for a full list of commands.", false);
    }
    embed.setTimestamp(helpers.convertDate(new Date(), message.guild.id));
    p.resolve(embed);
    return p.promise;
}

function postCalendar(message, dayMap) {
    let calendarPath = path.join(__dirname, "..", "stores", message.guild.id, "calendar.json");
    let calendar = helpers.readFile(calendarPath);
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);

    if (calendar["calendarMessageId"]) {
        message.channel.fetchMessage(calendar["calendarMessageId"]).then((message) => {
            message.delete();
        }).catch((err) => {
            if (err.code === 10008) {
                calendar["calendarMessageId"] = "";
                helpers.writeGuildSpecific(message.guild.id, calendar, "calendar");
                return helpers.log("error fetching previous calendar in guild: " + message.guild.id + ":" + err);
            }
            else {
                return helpers.log("error fetching previous calendar in guild: " + message.guild.id + ":" + err);
            }
        });
    }
    generateCalendar (message, dayMap).then((embed) => {
        message.channel.send({embed}).then((sent) => {
          calendar["calendarMessageId"] = sent.id;
          sent.pin();
        })
    }).then((confirm) => {
        setTimeout(function func() {
            helpers.writeGuildSpecific(message.guild.id, calendar, "calendar");
        }, 2000);
    }).catch((err) => {
        helpers.log("funtion postCalendar error in guild: " + message.guild.id + ": " + err);
    });
}

function updateCalendar(message, dayMap) {
  let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
  let guildSettings = helpers.readFile(guildSettingsPath);
  let calendarPath = path.join(__dirname, "..", "stores", message.guild.id, "calendar.json");
  let calendar = helpers.readFile(calendarPath);
  if (calendar["calendarMessageId"] === "") {
      clearInterval(autoUpdater[message.guild.id]);
      message.channel.send("I can't find the last calendar I posted. Use `!display` and I'll post a new one.").then((m) => {});
      return;
  }
  let messageId = calendar["calendarMessageId"];
  message.channel.fetchMessage(messageId).then((m) => {
      generateCalendar(message, dayMap).then((embed) => {
          m.edit({embed});
      })
  }).catch((err) => {
      if (err.code === 1008) {
          helpers.log("error fetching previous calendar message in guild: " + message.guild.id + ": " + err);
          calendar["calendarMessageId"] = "";
          helpers.writeGuildSpecific(message.guild.id, calendar, "calendar");
          return;
      }
      else {
          helpers.log("error fetching previous calendar message in guild: " + message.guild.id + ": " + err);
          calendar["calendarMessageId"] = "";
          helpers.writeGuildSpecific(message.guild.id, calendar, "calendar");
          return;
      }
  });
}

function quickAddEvent(message, calendarId) {
    let p = defer();
    let pieces = message.content.split(" ");
    if (!pieces[1]) {
      return message.channel.send("You need to enter an argument for this command. i.e `!scrim xeno thursday 8pm - 9pm`")
        .then((m) => {
            m.delete(5000);
        });
    }
    let text = "";
    for (let i = 1; i < pieces.length; i++) {
        text += pieces[i] + " ";
    }
    let params = {
        text
      };
    cal.Events.quickAdd(calendarId, params).then((resp) => {
        let json = resp;
        message.channel.send("Event `" + resp.summary + "` on `" +  resp.start.dateTime + "` has been created").then((m) => {
            m.delete(5000);
        });
        p.resolve(resp);
    }).catch((err) => {
        helpers.log("function updateCalendar error in guild: " + message.guild.id + ": " + err);
        p.reject(err);
    });
    return p.promise;
}

function displayOptions(message) {
    let pieces = message.content.split(" ");
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    if (pieces[1] === "help") {
        if (pieces[2] === "1") {
            guildSettings["helpmenu"] = "1";
            helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
            message.channel.send("Okay I've turned the calendar help menu on");
        }
        else if (pieces[2] === "0") {
            guildSettings["helpmenu"] = "0";
            helpers.writeGuildSpecific(message.guild.id, guildSettings, "settings");
            message.channel.send("Okay I've turned the calendar help menu off");
        }
        else {
            message.channel.send ("Please only use 0 or 1 for the calendar help menu options, (off or on)");
        }
    }
    else {
        message.channel.send("I don't think thats a valid display option, sorry!");
    }
}

function deleteEventById(eventId, calendarId, dayMap, message) {
    let params = {
        sendNotifications: true
      };
    return cal.Events.delete(calendarId, eventId, params).then((resp) => {
        getEvents(message, calendarId, dayMap);
        setTimeout(function func() {
            updateCalendar(message, dayMap);
        }, 2000);
    }).catch((err) => {
        helpers.log("function deleteEventById error in guild: " + message.guild.id + ": " + err);
    });
}

function deleteEvent(message, calendarId, dayMap) {
    let calendarPath = path.join(__dirname, "..", "stores", message.guild.id, "calendar.json");
    let calendar = helpers.readFile(calendarPath);
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    let deleteMessages = [];
    deleteMessages.push(message.id);
    let dayDate;
    let dTime;
    let keyID;
    let gcalID;
    let pieces = message.content.split(" ");
    let searchDay = helpers.firstUpper(pieces[1].toLowerCase());
    let searchTime = pieces[2].toLowerCase();

    for (let i = 0; i < 7; i++) {
        if(helpers.dayString(dayMap[i].getDay()) === searchDay) {
            dayDate = new Date(dayMap[i]);
            keyID = i;
        }
    }
    if (searchTime.indexOf("pm") !== -1) {
        if (searchTime === "12pm") {
            dTime = "12";
        }
        else {
            let temp = parseInt(searchTime.split("pm")[0],10);
            dTime = String((temp + 12));
        }
    }
    if (searchTime.indexOf("am") !== -1) {
        if (searchTime === "12am") {
            dTime = "00";
        }
        if (searchTime.split("a")[0].length === 2) {
            dTime = searchTime.split("a")[0];
        }
        if (searchTime.split("a")[0].length === 1) {
            dTime = "0" + searchTime.split("a")[0];
        }
    }
    let tz = guildSettings["timezone"].split("T")[1];
    let delDate = dayDate.getFullYear() + "-" + helpers.prependZero(dayDate.getMonth() + 1) + "-" + helpers.prependZero(dayDate.getDate()) + "T" + dTime + ":00:00" + tz;
    let key = "day" + String(keyID);

    for (let j = 0; j < calendar[key].length; j++) {
        let eventDate = new Date(calendar[key][j]["start"]["dateTime"]);
        let searchDate = new Date(delDate);
        if (Math.abs((eventDate - searchDate)) < 100) {
            message.channel.send(`Are you sure you want to delete the event **${calendar[key][j]["summary"]}** on ${searchDay} at ${searchTime}? **(y/n)**`)
            .then((res) => {
                res.delete(10000);
            });
            const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, { time: 10000});
            collector.on("collect", (m) => {
                deleteMessages.push(m.id);
                if(m.content.toLowerCase() === "y" || m.content.toLowerCase() === "yes") {
                    deleteEventById(calendar[key][j]["id"], calendarId, dayMap, message).then((del) => {
                        message.channel.send(`Event **${calendar[key][j]["summary"]}** deleted`).then((res) => {
                            res.delete(10000);
                        });
                    });
                }
                else {
                    message.channel.send("Okay, I won't do that").then((res) => {
                        res.delete(5000);
                    });
                }
                for(let k = 0; k < deleteMessages.length; k++) {
                    message.channel.fetchMessage(deleteMessages[k]).then((m) => {
                        m.delete(5000);
                    });
                }
                return collector.stop();
            });
            collector.on("end", (collected, reason) => {
                if (reason === "time") {
                    message.channel.send("command response timeout").then((res) => {
                        res.delete(5000);
                    });
                }
            });
            return;
        }
    }
    message.channel.send("I couldn't find that event, try again").then((res) => {
        res.delete(10000);
    });
} // needs catches.

function calendarUpdater(message, calendarId, dayMap) {
    try {
        dayMap = createDayMap(message);
        setTimeout(function func() {
            getEvents(message, calendarId, dayMap);
        }, 2000);
        setTimeout(function func() {
            updateCalendar(message, dayMap);
        }, 4000);
    } catch (err) {
        helpers.log("error in autoupdater in guild: " + message.guild.id + ": " + err);
        clearInterval(autoUpdater[message.guild.id]);
    }
}

function displayStats(message) {
    let embed = new bot.discord.RichEmbed()
    .setColor("RED")
    .setTitle(`Niles Bot ${settings.secrets.current_version}`)
    .setURL("https://github.com/seanecoffey/Niles")
    .addField("Servers", bot.client.guilds.size, true)
    .addField("Uptime", moment.duration(process.uptime(), "seconds").format("dd:hh:mm:ss"), true)
    .addField("Ping", `${(bot.client.ping).toFixed(0)} ms`, true)
    .addField("RAM Usage", `${(process.memoryUsage().rss / 1048576).toFixed()}MB/${(os.totalmem() > 1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + " GB" : (os.totalmem() / 1048576).toFixed() + " MB")}
    (${(process.memoryUsage().rss / os.totalmem() * 100).toFixed(2)}%)`, true)
    .addField("System Info", `${process.platform} (${process.arch})\n${(os.totalmem() > 1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + " GB" : (os.totalmem() / 1048576).toFixed(2) + " MB")}`, true)
    .addField("Libraries", `[Discord.js](https://discord.js.org) v${bot.discord.version}\nNode.js ${process.version}`, true)
    .addField("Links", "[Bot invite](https://discordapp.com/oauth2/authorize?permissions=97344&scope=bot&client_id=" + bot.client.user.id + ") | [Support server invite](https://discord.gg/jNyntBn) | [GitHub](https://github.com/seanecoffey/Niles)", true)
    .setFooter("Created by Sean#8856");
    message.channel.send({ embed }).catch((err) => {
        helpers.log(err);
    });
}

exports.deleteUpdater = function(guildid) {
    clearInterval(autoUpdater[guildid]);
};

function delayGetEvents(message, calendarId, dayMap) {
    setTimeout(function func() {
        getEvents(message, calendarId, dayMap);
    }, 1000);
}

// Message Listener

function run(message) {
    let guildSettingsPath = path.join(__dirname, "..", "stores", message.guild.id, "settings.json");
    let guildSettings = helpers.readFile(guildSettingsPath);
    let calendarID = guildSettings["calendarID"];
    let calendarPath = path.join(__dirname, "..", "stores", message.guild.id, "calendar.json");
    let calendar = helpers.readFile(calendarPath);
    let dayMap = createDayMap(message);
    //Pull updates on set interval
    autoUpdater[message.guild.id] = setInterval(function func() {}, 0);
    if (autoUpdater[message.guild.id]["_idleTimeout"] !== settings.secrets.calendar_update_interval) {
      try {
          autoUpdater[message.guild.id] = setInterval(function func() {calendarUpdater(message, calendarID, dayMap);}, settings.secrets.calendar_update_interval);
        } catch (err) {
            helpers.log("error starting the autoupdater" + err);
            clearInterval(autoUpdater[message.guild.id]);
        }
    }
    const cmd = message.content.toLowerCase().substring(guildSettings.prefix.length).split(" ")[0];
    if (cmd === "ping" || helpers.mentioned(message, "ping")) {
        message.channel.send(`:ping_pong: !Pong! ${bot.client.pings[0]}ms`).catch((err) => {
            helpers.sendMessageHandler(message, err);
        });
    }
    if (cmd === "help" || helpers.mentioned(message, "help")) {
        message.channel.send(HELP_MESSAGE);
        message.delete(5000);
    }
    if (cmd === "invite" || helpers.mentioned(message, "invite")) {
      message.channel.send({
        embed: new bot.discord.RichEmbed()
            .setColor("#FFFFF")
            .setDescription("Click [here](https://discordapp.com/oauth2/authorize?permissions=97344&scope=bot&client_id=" + bot.client.user.id + ") to invite me to your server")
      }).catch((err) => {
          helpers.sendMessageHandler(message, err);
      });
      message.delete(5000);
    }
    if (["setup", "start", "id", "tz", "prefix"].includes(cmd) || helpers.mentioned(message, ["setup", "start", "id", "tz", "prefix"])) {
        try {
            init.run(message);
        }
        catch (err) {
            helpers.log("error trying to run init message catcher in guild: " + message.guild.id + ": " + err);
        }
        message.delete(5000);
    }
    if (cmd === "init" || helpers.mentioned(message, "init")) {
        guilds.create(message.guild);
        message.delete(5000);
    }
    if (["clean", "purge"].includes(cmd) || helpers.mentioned(message, ["clean", "purge"])) {
        deleteMessages(message);
    }
    if (cmd === "display" || helpers.mentioned(message, "display")) {
        delayGetEvents(message, calendarID, dayMap);
        setTimeout(function func() {
            postCalendar(message, dayMap);
            if (autoUpdater[message.guild.id]["_idleTimeout"] !== settings.secrets.calendar_update_interval) {
                autoUpdater[message.guild.id] = setInterval(function func() {calendarUpdater(message, calendarID, dayMap);}, settings.secrets.calendar_update_interval);
            }
        }, 2000);
        message.delete(5000);
    }
    if (cmd === "update" || helpers.mentioned(message, "update")) {
        if (calendar["calendarMessageId"] === "") {
          clearInterval(autoUpdater[message.guild.id]);
          message.channel.send("I can't find the last calendar I posted. Use `!display` and I'll post a new one.").then((m) => {});
          message.delete(5000);
          return;
        }
        delayGetEvents(message, calendarID, dayMap);
        setTimeout(function func() {
            updateCalendar(message, dayMap);}, 2000);
            message.delete(5000);
    }
    if(["create", "scrim"].includes(cmd) || helpers.mentioned(message, ["create", "scrim"])) {
        quickAddEvent(message, calendarID).then((resp) => {
          getEvents(message, calendarID, dayMap);
        }).then((resp) => {
          setTimeout(function func() {
              updateCalendar(message, dayMap);
          }, 2000);
        }).catch((err) => {
            helpers.log("error creating event in guild: " + message.guild.id + ": " + err);
        });
        message.delete(5000);
    }
    if (cmd === "delete" || helpers.mentioned(message, "delete")) {
        if (message.content.split(" ").length === 3) {
            deleteEvent(message, calendarID, dayMap);
        }
        else {
            message.channel.send("Hmm.. I can't process that request, delete using the format ``!delete <day> <start time>`` i.e ``!delete tuesday 8pm``")
            .then((m) => {
                m.delete(10000);
            });
        }
        message.delete(5000);
    }
    if (cmd === "displayoptions" || helpers.mentioned(message, "displayoptions")) {
        displayOptions(message);
        message.delete(5000);
    }
    if (["stats", "info"].includes(cmd) || helpers.mentioned(message, ["stats", "info"])) {
        displayStats(message);
        message.delete(5000);
    }
    if (cmd === "get" || helpers.mentioned(message, "get")) {
        getEvents(message, calendarID, dayMap);
        message.delete(5000);
    }
}

module.exports = {
    run
  };
