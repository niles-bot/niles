const time = require('time-parser');
const moment = require('moment');
const fs = require('fs');
require('moment-duration-format');
let columnify = require('columnify');
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);
let defer = require('promise-defer');
const CONFIG = require('../settings.js');
const CalendarAPI = require('node-google-calendar');
let cal = new CalendarAPI(CONFIG);
const guilds = require('../handlers/guilds');
let guilddb = require('../stores/guilddb.json');
const init = require('../handlers/init.js');

//Handle Commands
exports.run = async function(message) {
  var calendarId = guilddb[message.guild.id]["calendarID"];
  //PREFIX
  if (mentioned(message, 'prefix'))
    message.channel.send(`My prefix in this server is \`${guilddb[message.guild.id]["prefix"]}\`.`);

  if(!guilddb[message.guild.id]["prefix"])
    guildb[message.guild.id]["prefix"] = '!';

  const cmd = message.content.toLowerCase().substring(guilddb[message.guild.id]["prefix"].length).split(' ')[0];
  console.log(cmd);
  //PING
  if (cmd === 'ping' || mentioned(message, 'ping'))
      message.channel.send(`:ping_pong: Pong! ${client.pings[0]}ms`)
      .then( out => {
        name = 'ping';
      })
  //HELP
  if (cmd === 'help' || mentioned(message, 'help')) {
      message.author.send(HELP_MESSAGE);
      message.channel.fetchMessage(message.id).then( m => {
        m.delete(1000)
      }).catch( e => console.log(e));
    }
  //CLEAN
  if (['clean','purge'].includes(cmd)) {
    pieces = message.content.split(' ');
    if (parseInt(pieces[1]) > 0 && parseInt(pieces[1]) < 100 ) {
      message.channel.send('**WARNING** - This will delete ' + pieces[1] + ' messages in this channel! Are you sure? (`y`/`n`)');
      number = parseInt(pieces[1]);
      rec = 0;
    } else {
      message.channel.send('**WARNING** - This will delete all messages in this channel! Are you sure? (`y`/`n`)');
      number = 97;
      rec = 1;
    }
    const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, { time: 30000});
    collector.on('collect', (m) => {
      if(m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'yes') {
        clean(message.channel, number + 3, rec)
      } else {
        message.channel.send('Okay, I won\'t do that');
        clean(message.channel, 3, 0)
      };
      return collector.stop();
    });
    collector.on('end', (collected, reason) => {
      if (reason === 'time')
        message.channel.send('Command response timeout');
        clean(message.channel,3,0);
    });
  }
  //INVITE
  if (cmd === 'invite' || mentioned(message, 'invite'))
        message.channel.send({
            embed: new discord.RichEmbed()
                .setColor('#FFFFF')
                .setDescription('Click [here](https://discordapp.com/oauth2/authorize?permissions=523344&scope=bot&client_id=' + client.user.id + ') to invite me to your server')
        });
  //RESTART - Need to add auth
  if (['reboot','restart','kill'].includes(cmd) || mentioned(message, ['reboot','restart','kill'])) {
    message.channel.fetchMessage(message.id).then( m => {
      m.delete()
    }).catch( e => console.log(e));
    await message.channel.send('Okay... I\'ll be back in a moment.');
    await client.destroy()
    .then(restart => process.exit(1));

  }
  //INITIALISE - Deprecate
  if (cmd === 'init' || mentioned(message, 'init')) {
    await clean(message.channel, 100, 1);
    await mapDays(message.guild).then(dayMap => {
      generateEvents(message.guild,calendarId, dayMap)
    });
    await mapDays(message.guild).then(dayMap => {
      createWeek(message.channel, dayMap)
    })
    await console.log('command init finished running');
  }
  //STATS
  if (['stats', 'info'].includes(cmd) || mentioned(message, ['stats', 'info'])) {
    let os = require('os'),
    embed = new discord.RichEmbed()
    .setColor('RED')
    .setTitle(`Niles Bot 0.1.3`)
    .setURL('https://github.com/seanecoffey/Niles')
    .addField('Servers', client.guilds.size, true)
    .addField('Uptime', moment.duration(process.uptime(), 'seconds').format('dd:hh:mm:ss'), true)
    .addField('Ping', `${(client.ping).toFixed(0)} ms`, true)
    .addField('RAM Usage', `${(process.memoryUsage().rss / 1048576).toFixed()}MB/${(os.totalmem() > 1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + ' GB' : (os.totalmem() / 1048576).toFixed() + ' MB')}
(${(process.memoryUsage().rss / os.totalmem() * 100).toFixed(2)}%)`, true)
    .addField('System Info', `${process.platform} (${process.arch})\n${(os.totalmem() > 1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + ' GB' : (os.totalmem() / 1048576).toFixed(2) + ' MB')}`, true)
    .addField('Libraries', `[Discord.js](https://discord.js.org) v${discord.version}\nNode.js ${process.version}`, true)
    .addField('Links', '[Bot invite](https://discordapp.com/oauth2/authorize?client_id=320434122344366082&scope=bot&permissions=523344) | [Support server invite](https://discord.gg/jNyntBn) | [GitHub](https://github.com/seanecoffey/Niles)', true)
    .setFooter('Created by Sean#8856');

    message.channel.send({ embed: embed});
  }
//CREATE NEW EVENTS
  if(['create', 'new', 'scrim'].includes(cmd) || mentioned(message, ['create', 'new','scrim'])) {
    let pieces = message.content.split(' ');
    if (pieces[1] == undefined || pieces[1] == '') {
      return message.channel.send('You need to enter an argument for this command. i.e `!scrim xeno thursday 8pm - 9pm`')
    }
    let stringToSend = '';
    for (let it = 1; it < pieces.length ; it ++) {
      stringToSend += pieces[it];
      stringToSend += ' ';
    }
    console.log(stringToSend);
    await quickAddEvent(stringToSend, calendarId).then( newevent => {
      message.channel.send('Event `' + newevent.summary + '` on `' +  newevent.start.dateTime + '` has been created');
    });
    await mapDays(message.guild).then (dayMap => {
      generateEvents(message.guild, calendarId, dayMap);
    });
    setTimeoutPromise(2000).then( wait => {
      mapDays(message.guild).then(dayMap => {
        updateWeek(message, dayMap);
      });
    });
  }
  //UPDATE - Syncs Google Events to Local JSON
  if(['update', 'sync', 'refresh'].includes(cmd) || mentioned(message, ['update','sync', 'refresh'])) {
    await mapDays(message.guild).then(dayMap => {
      generateEvents(message.guild,calendarId, dayMap)
    });
    setTimeoutPromise(2000).then( wait => {
      mapDays(message.guild).then(dayMap => {
        updateWeek(message, dayMap);
      });
    });
    message.channel.fetchMessage(message.id).then( m => {
      m.delete(2500)
    }).catch( e => console.log(e));
  }
  //DELETE
  if(cmd === 'delete') {
    if (message.content.split(' ').length === 3) {
      await mapDays(message.guild).then(dayMap => {
        deleteFindEvent(message, calendarId, dayMap);
      });
    } else {
      message.channel.send('Hmm.. I can\'t process that request, delete using the format ``!delete <day> <start time>`` i.e. ``!delete tuesday 8pm``').then(msg => {
        msg.delete(10000);
      });
    }
  }
  //DISPLAYS THE CALENDAR IN CURRENT CHANNEL
  if(cmd === 'display' || mentioned(message, 'display')) {
    await mapDays(message.guild).then( dayMap => {
      createWeek(message.channel,dayMap)
    });
    message.channel.fetchMessage(message.id).then( m => {
      m.delete(2000)
    }).catch( e => console.log(e));
  }
  //Update google Calendar ID or Timezone.
  if(['id','tz'].includes(cmd)) {
    try {
      init.run(message)
    } catch (e) {
      console.log(e)
    }
  }
  if(cmd === 'all') {
    mapDays(message.guild).then(dayMap => {
    listAllEventsInCalendar(calendarId, message,dayMap);
  });
  }
};

// HELP MESSAGE
const HELP_MESSAGE = "```\
        Niles Usage\n\
---------------------------\n\
!display             -  Displays the calendar (chat prompts), without deleting any messages\n\
!init                -  Deletes all messages and displays the calendar\n\
!clean / !purge      -  Deletes all the messages in current channel\n\
!restart             -  Restart Niles :( \n\
!update / !sync      -  Sync Google calendar events with backend database\n\
!create / !scrim     -  Create events using GCal's default interpreter - works best like ``!scrim xeno June 5 8pm - 9pm``\n\
!delete              -  Delete an event using the form ``!delete Friday 8pm``, only works in this form i.e. ONE day and START time\n\
!stats / !info       -  Display list of statistics and information about the Niles bot\n\
!invite              -  Get the invite link for Niles to join your server!\n\
!help                -  Display this message\n\
```"

//listallevents on the calendar (date range)
function listAllEventsInCalendar(calendarId, message, dayMap) {
	let eventsArray = [];
  tz = guilddb[message.guild.id]["timezone"];
  var startDate = JSON.stringify(dayMap[0]).split('T')[0].split('"')[1] + 'T00:00:00' + tz.split('T')[1];
  console.log(startDate);
  var endDate = JSON.stringify(dayMap[6]).split('T')[0].split('"')[1] + 'T23:59:00' + tz.split('T')[1];
  console.log(endDate);
  let params = {
    timeMin:startDate,
    timeMax:endDate,
    singleEvents: true,
    orderBy: 'startTime'
  };
	cal.Events.list(calendarId, params)
		.then(json => {
			for (let i = 0; i < json.length; i++) {
				let event = {
					id: json[i].id,
					summary: json[i].summary,
					location: json[i].location,
					start: json[i].start,
					end: json[i].end,
					status: json[i].status
				};
				eventsArray.push(event);
			}
			console.log('List of all events on calendar');
			console.log(JSON.stringify(eventsArray));
      message.channel.send('List of all calendar events:');
      for (let i = 0; i < json.length; i++) {
        message.channel.send('```'+JSON.stringify(eventsArray[i])+'```');
      }
		}).catch(err => {
			console.log('Error: listAllEventsInCalendar -' + err);
      message.channel.send('```'+String(err)+'```');
		});
}

//Clean function deletes messages from channel
function clean(delChannel, number, rec) {
  var deferred = defer();
  delChannel.fetchMessages({ limit: number })
  .then(messages => {
    console.log(`Deleting ${messages.size} messages`);
    if (messages.size < 2) {
      delChannel.send('cleaning');
      deferred.resolve(2);
      clean(delChannel);
    }
    if (messages.size == 100 && rec == 1) { //maxes out at 50 (why?) so recursively delete in blocks of 50
      delChannel.bulkDelete(messages); //need to wait for this for a while.
      deferred.resolve(3);
      clean(delChannel);
    }
    else {
      delChannel.bulkDelete(messages);
      deferred.resolve(1);
    }
  })
  .catch(err => {
    console.log(err);
    deferred.reject(new Error ('could not clean up messages'));
  })
  return deferred.promise;
}

//Create the list of events in the channel
function createWeek(thisChannel, dayMap) {
  guilddbString = '/niles/stores/' + String(thisChannel.guild.id) + 'db.json';
  gdb = require(guilddbString);
  var finalString = '';

  for (let i = 0; i < 7; i++) {
    var key = 'day' + String(i);
    var sendString='';
    sendString += '\n**' + checkDay(dayMap[i].getDay()) + '** - ' + checkMonth(dayMap[i].getMonth()) + ' ' + dayMap[i].getDate() + '\n';
    if (gdb[key] == '[]' || gdb[key] == [] || gdb[key] == 0) {
      sendString += '```  ```';
    } else {
      sendString += '```';
      //Map events for each day
      let tempString = {};
        for (let m = 0; m < gdb[key].length; m++) {
          let options = {
            showHeaders : false,
            columnSplitter: ' | ',
            columns: ["time", "events"],
            config: {
              time: {minWidth: 11},
              events: {minWidth: 11}
            }
          };
          tempStartDate = new Date(gdb[key][m]["start"]["dateTime"]);
          tempStartDate = convertDate(tempStartDate,thisChannel.guild.id);
          tempFinDate = new Date(gdb[key][m]["end"]["dateTime"]);
          tempFinDate = convertDate(tempFinDate,thisChannel.guild.id);
          console.log(gdb[key][m]["summary"]);
          tempString['\n - ' + stringPrefix(parseInt(tempStartDate.getHours())) + '-' + stringPrefixSuffix(parseInt(tempFinDate.getHours()))] = gdb[key][m]["summary"];
          sendString += columnify(tempString, options);
          console.log(columnify(tempString, options));

        }
        sendString += '```';
      }
      finalString += sendString;
    };
    thisChannel.send({
      embed: new discord.RichEmbed()
        .setTitle('CALENDAR')
        .setURL('https://calendar.google.com/calendar/embed?src=' + guilddb[thisChannel.guild.id]["calendarID"])
        .setColor('BLUE')
        .setDescription(finalString)
        .setFooter('Last update')
        .addField('USING THIS CALENDAR', 'To create events use ``!create`` or ``!scrim`` followed by your event details i.e. ``!scrim xeno on monday at 8pm-10pm``\n\nTo delete events use``!delete <day> <start time>`` i.e. ``!delete monday 5pm``\n\nYou will have to use ``!update`` to update this calendar, eventually you won\'t have to!\n\nEnter ``!help`` for a full list of commands.', false)
        .setTimestamp()
      }).then( sent => {
      gdb['msgid'] = sent.id;
      sent.pin();
    }).then(confirm => {
    console.log('channel schedule updated');
    //write the init message IDs to the DB
    fs.writeFile(guilddbString, JSON.stringify(gdb, '', '\t'), (err) => {
      if (err)
        return console.log(Date() + 'createGuild error: ' + err);
      });
  })
  .catch(err => {
    console.log(err);
  })
}

//update the existing calendar (only works after init)
function updateWeek(message, dayMap) {
  guilddbString = '/niles/stores/' + String(message.guild.id) + 'db.json';
  gdb = require(guilddbString);
  var nextkey = 0;
  var sendString = '';
  var finalString = '';

  for (let i = 0; i < 7; i++) {
    var key = 'day' + String(i);
    var sendString='';
    sendString += '\n**' + checkDay(dayMap[i].getDay()) + '** - ' + checkMonth(dayMap[i].getMonth()) + ' ' + dayMap[i].getDate() + '\n';
    if (gdb[key] == '[]' || gdb[key] == [] || gdb[key] == 0) {
      sendString += '```  ```';
    } else {
      sendString += '```';
      //Map events for each day
      let tempString = {};
        for (let m = 0; m < gdb[key].length; m++) {
          let options = {
            showHeaders : false,
            columnSplitter: ' | ',
            columns: ["time", "events"],
            config: {
              time: {minWidth: 11},
              events: {minWidth: 11}
            }
          };
          tempStartDate = new Date(gdb[key][m]["start"]["dateTime"]);
          tempStartDate = convertDate(tempStartDate,thisChannel.guild.id);
          tempFinDate = new Date(gdb[key][m]["end"]["dateTime"]);
          tempFinDate = convertDate(tempFinDate,thisChannel.guild.id);
          console.log(gdb[key][m]["summary"]);
          tempString['\n - ' + stringPrefix(parseInt(tempStartDate.getHours())) + '-' + stringPrefixSuffix(parseInt(tempFinDate.getHours()))] = gdb[key][m]["summary"];
          sendString += columnify(tempString, options);
          console.log(columnify(tempString, options));

        }
        sendString += '```';
      }
      finalString += sendString;
    };
    msgId = gdb['msgid'];
    message.channel.fetchMessage(msgId).then( m => {
      m.edit({
        embed: new discord.RichEmbed()
          .setTitle('CALENDAR')
          .setURL('https://calendar.google.com/calendar/embed?src=' + guilddb[message.guild.id]["calendarID"])
          .setColor('BLUE')
          .setDescription(finalString)
          .setFooter('Last update')
          .addField('USING THIS CALENDAR', 'To create events use ``!create`` or ``!scrim`` followed by your event details i.e. ``!scrim xeno on monday at 8pm-10pm``\n\nTo delete events use``!delete <day> <start time>`` i.e. ``!delete monday 5pm``\n\nYou will have to use ``!update`` to update this calendar, eventually you won\'t have to!\n\nEnter ``!help`` for a full list of commands.', false)
          .setTimestamp()
        })
    }).catch (err => console.log(err));
    console.log('calendar updated');
}

//map next 7 dates in array
function mapDays(guild) {
  let p = defer();
  var day_map = [];
  var d = new Date();
  var nd = convertDate(d, guild.id);
  day_map[0] = new Date(nd);
  for (let i = 1; i < 7; i++) {
    day_map[i] = new Date(nd.setDate(nd.getDate() + 1));
  }
  p.resolve(day_map);
  return p.promise;
}

//quick add event using google text processing
function quickAddEvent(text, calendarId) {
  var p = defer();
	let params = {
		'text': text
	}
	cal.Events.quickAdd(calendarId, params)
		.then(resp => {
			let json = resp;
			console.log('inserted quickAddEvent:');
			console.log(json);
      p.resolve(resp);
		})
		.catch(err => {
			console.log('Error: quickAddEvent-' + err);
      p.reject(err);
		});
    return p.promise;
}

//Search for events on google calendar and push to JSON file
function generateEvents(guild, calendarId, dayMap) {
  var g = defer();
  guilddbString = '/niles/stores/' + String(guild.id) + 'db.json';
  gdb = require(guilddbString);
  let allEvents = [];
  tz = guilddb[guild.id]["timezone"];
  var startDate = JSON.stringify(dayMap[0]).split('T')[0].split('"')[1] + 'T00:00:00' + tz.split('T')[1];
  console.log(startDate);
  var endDate = JSON.stringify(dayMap[6]).split('T')[0].split('"')[1] + 'T23:59:00' + tz.split('T')[1];
  console.log(endDate);
  let params = {
    timeMin:startDate,
    timeMax:endDate,
    singleEvents: true,
    orderBy: 'startTime'
  };
  cal.Events.list(calendarId, params)
  .then(json => {
    for (let i = 0; i < json.length; i++) {
      let event = {
        id: json[i].id,
        summary: json[i].summary,
        start: json[i].start,
        end: json[i].end,
      };
      allEvents.push(event);
    }
    for(let day = 0; day < 7; day++) {
      var key = 'day' + String(day);
      var matches = [];
      for(let j = 0; j < json.length; j++) {
        tempDate = new Date(allEvents[j]["start"]["dateTime"]);
        if ((dayMap[day].getFullYear() == tempDate.getFullYear() && dayMap[day].getMonth() == tempDate.getMonth() && dayMap[day].getDate() == tempDate.getDate())) {
          matches.push(allEvents[j]);
        }
        if (allEvents[j]["start"]["date"]) {
          allDayEvent = new Date(allEvents[j]["start"]["date"]);
          if ((dayMap[day].getFullYear() == allDayEvent.getFullYear() && dayMap[day].getMonth() == allDayEvent.getMonth() && dayMap[day].getDate() == allDayEvent.getDate())) {
            matches.push(allEvents[j]);
          }
        }
      }
      gdb[key] = matches;
    }
    g.resolve(dayMap);
    fs.writeFile(guilddbString, JSON.stringify(gdb, '', '\t'), (err) => {
      if (err)
        return console.log(Date() + 'createEvents() error: ' + err);
    })}).catch(err => {
  console.log('Error: createEvents -' + err);
});
return g.promise;
}

//Find eventId from search string
//Need to improve handling of time formatting, i.e. '8' instead of '8pm' does nothing
function deleteFindEvent(message, calendarId, dayMap) {
  deleteMessages = [];
  deleteMessages.push(message.id);
  guilddbString = '/niles/stores/' + String(message.guild.id) + 'db.json';
  gdb = require(guilddbString);
  var dayDate;
  var delDate;
  var dTime;
  var keyID;
  var gcalID;
  pieces = message.content.split(' ');
  var day = firstUpper(pieces[1].toLowerCase());
  var time = pieces[2].toLowerCase();

  for (let i = 0; i < 7; i++) {
    if(checkDay(dayMap[i].getDay()) === day) {
      dayDate = new Date(dayMap[i]);
      keyID = i;
    }
  }
  if(time.indexOf('pm') != -1) {// need to fix this
    if (time === '12pm') {
      dTime = '12';
    } else {
      tempInt = parseInt(time.split('pm')[0]);
      dTime = String((tempInt + 12));
    }
  }
  if(time.indexOf('am') != -1) {
    if (time === '12am') {
      dTime = '00';
    }
    if (time.split('a')[0].length == 2) {
      dTime = time.split('a')[0];
    }
    if (time.split('a')[0].length == 1) {
      dTime = '0' + time.split('a')[0];
    }
  }
  //NEED TO SIMPLIFY THIS NOW THAT ITS A DATE COMPARISON
  var tzone = (guilddb[message.guild.id]["timezone"]).split('T')[1];
  delDate = dayDate.getFullYear()+'-'+ prependZero(dayDate.getMonth()+1) + '-' + prependZero(dayDate.getDate()) + 'T' + dTime + ':00:00'+tzone;
  var key = 'day' + String(keyID);
  for (let j = 0; j < gdb[key].length; j++) {
    comp1 = new Date(gdb[key][j]["start"]["dateTime"]);
    comp2 = new Date(delDate);
    if(Math.abs((comp1 - comp2)) < 100) {
      message.channel.send('Are you sure you want to delete the event: ' + '`'+ gdb[key][j]["summary"] + '` ' + 'on ' + day + ' at ' + time + ' ? **(y/n)**').then(res => {
        res.delete(5000)
      })
      const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, { time: 5000 });
      collector.on('collect',(m) => {
        deleteMessages.push(m.id);
        if(m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'yes') {
          deleteEvent(gdb[key][j]["id"], calendarId, message, dayMap).then( del => {
            message.channel.send('Event' + '`'+ gdb[key][j]["summary"] + '` ' + 'deleted').then(res => {
              res.delete(5000);
              mapDays(message.guild).then(dayMap => {
                updateWeek(message, dayMap);
              });
            });

          })
        } else {
          message.channel.send('Okay, I won\'t do that').then(res => {
            res.delete(5000)
            });
          };
          console.log(JSON.stringify(deleteMessages));
          for(let k = 0;k<deleteMessages.length;k++) {
            message.channel.fetchMessage(deleteMessages[k]).then(msg => {
              msg.delete(5000);
            });
          }
          return collector.stop();
        });
        collector.on('end', (collected, reason) => {
          if (reason === 'time')
            message.channel.send('Command response timeout').then(res => {
              res.delete(5000);
            });
          });
        return;
      }
    }
    message.channel.send('I couldn\'t find that event, try again!').then( res => {
      res.delete(10000);
    });
  }

//delete gcal events by ID
function deleteEvent(eventId, calendarId, message, dayMap) {
	let params = {
		sendNotifications: true
	};
	return cal.Events.delete(calendarId, eventId, params)
		.then(resp => {
			console.log('Deleted Event Response: ');
			console.log(resp);
      generateEvents(message.guild, calendarId, dayMap);
      setTimeoutPromise(2000).then( wait => {
        mapDays(message.guild).then(dayMap => {
          updateWeek(message, dayMap);
        });
      });
		})
		.catch(err => {
			console.log('Error: deleteEvent-' + err);
		});
}

// HELPER FUNCTIONS

function mentioned(msg, x) {
    if (!Array.isArray(x)) {
        x = [x];
    }
    return msg.isMentioned(client.user.id) && x.some((c) => msg.content.toLowerCase().includes(c));
}

//return the day in string
function checkDay(number) {
  var days = ['Sunday','Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[number];
}

//return the month in string
function checkMonth(number) {
  var mths = ['January', 'February', 'March', 'April','May', 'June', 'July','August','September','October','November','December'];
  return mths[number];
}

//functions for generating message formatting
function stringPrefix(hour) {
  var timePieces = ['12','1','2','3','4','5','6','7','8','9','10','11','12','1','2','3','4','5','6','7','8','9','10','11'];
    return timePieces[hour];
}
function stringPrefixSuffix(hour) {
  var timePieces = ['12 AM:','1 AM:','2 AM:','3 AM:','4 AM:','5 AM:','6 AM:','7 AM:','8 AM:','9 AM:',
  '10 AM:','11 AM:','12 PM:','1 PM:','2 PM:','3 PM:','4 PM:','5 PM:','6 PM:','7 PM:','8 PM:','9 PM:','10 PM:','11 PM:'];
    return timePieces[hour];
}

function firstUpper(string)
{
    return string.charAt(0).toUpperCase() + string.slice(1);
}

//convert single digit days/months to 2 digit strings
function prependZero(item) {
  var converted;
  if (String(item).length < 2) {
    converted = '0'+ String(item);
    return converted;
  } else {
    return String(item);
  }
}

//Convert dates to the server set timezone
function convertDate(date, guildid) {
  tz = guilddb[guildid]["timezone"];
  pieces = tz.split('GMT')[1];
  hour = pieces.split(':')[0];
  minutes = pieces.split(':')[1];
  if (minutes == '00') {
    minutes = '.';
  }
  if (minutes == '30') {
    minutes ='.5';
  }
  offset = parseFloat(hour + minutes);
  var utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  var nd = new Date(utc + (3600000*offset));
  return nd;
}

function daysNoHours(message) {
  var dayMap = mapDays(message.guild);
  let days = {};
  days['day0'] = JSON.stringify(dayMap[0]).split('T')[0];
  days['day1'] = JSON.stringify(dayMap[1]).split('T')[0];
  days['day2'] = JSON.stringify(dayMap[2]).split('T')[0];
  days['day3'] = JSON.stringify(dayMap[3]).split('T')[0];
  days['day4'] = JSON.stringify(dayMap[4]).split('T')[0];
  days['day5'] = JSON.stringify(dayMap[5]).split('T')[0];
  days['day6'] = JSON.stringify(dayMap[6]).split('T')[0];
  return days;
}

function writeGuilddb(guilddb) {
  fs.writeFile('./stores/guilddb.json', JSON.stringify(guilddb, '','\t'), (err) => {
    if (err)
      return console.log(Date() + ' write tz error: ' + err);
    });
  }
