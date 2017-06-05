const time = require('time-parser');
const moment = require('moment');
const fs = require('fs');
require('moment-duration-format');

//promises - need to deprecate
var defer = require('promise-defer');
//Niles specific settings & Google Calendar
const CONFIG = require('../settings.js');
const CalendarAPI = require('node-google-calendar');
let cal = new CalendarAPI(CONFIG);
//Require other handlers and read the main list of guilds.
const guilds = require('../handlers/guilds');
guilddb = require('../stores/guilddb.json');
const init = require('../handlers/init.js');

//handle and store temporary messages - will deprecate
const tempMessage = require('./messages.js');
tempMessagedb = require('../stores/tempMessages.json');

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
        tempMessage.createDayMessage(out, name);
        //Testing temporary message storage and deletion
      })
  //HELP
  if (cmd === 'help' || mentioned(message, 'help'))
      message.author.send(HELP_MESSAGE);
  //CLEAN
  if (['clean','purge'].includes(cmd)) {
    message.channel.send('**WARNING** - This will delete all messages in this channel! Are you sure? (`y`/`n`)');
    const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, { time: 30000});
    collector.on('collect', (m) => {
      if(m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'yes') {
        clean(message.channel)
      } else {
        message.channel.send('Okay, I won\'t do that');
      };
      return collector.stop();
    });
    collector.on('end', (collected, reason) => {
      if (reason === 'time')
        message.channel.send('Command response timeout');
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
    await message.channel.send('Okay... I\'ll be back in a moment.');
    await client.destroy()
    .then(restart => process.exit(1))
  }
  //INITIALISE - Deprecate
  if (cmd === 'init' || mentioned(message, 'init')) {
    await clean(message.channel);
    await generateEvents(message.guild, calendarId);
    await createWeek(message.channel);
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
    quickAddEvent(stringToSend, calendarId);
    setTimeout(generateEvents(message.guild, calendarId), 30000)
    .catch(e => {
      console.log('timeout error: ' + e);
    });
  }
  //UPDATE - Syncs Google Events to Local JSON
  if(['update', 'sync', 'refresh'].includes(cmd) || mentioned(message, ['update','sync', 'refresh'])) {
    generateEvents(message.guild, calendarId);
  }
  //DELETE
  if(cmd === 'delete') {
    if (message.content.split(' ').length === 3) {
      deleteFindEvent(message, calendarId)
    } else {
      message.channel.send('Hmm.. I can\'t process that request, delete using the format ``!delete <day> <start time>`` i.e. ``!delete tuesday 8pm``');
    }
  }
  //DISPLAYS THE CALENDAR IN CURRENT CHANNEL
  if(cmd === 'display' || mentioned(message, 'display')) {
    createWeek(message.channel);
  }
  //PUSH UPDATE - Pushes update to last written calendar using edits
  if(cmd === 'pushupdate') {
    updateWeek(message);
  }
  //Update google Calendar ID or Timezone.
  if(['id','tz'].includes(cmd)) {
    try {
      init.run(message)
    } catch (e) {
      console.log(e)
    }
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

//helper functions
function mentioned(msg, x) {
    if (!Array.isArray(x)) {
        x = [x];
    }
    return msg.isMentioned(client.user.id) && x.some((c) => msg.content.toLowerCase().includes(c));
}

//listallevents on the calendar
function listAllEventsInCalendar(calendarId) {
  let calDelay = defer();
	let eventsArray = [];
	let params = {};
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
			console.log(eventsArray);
      console.log(eventsArray.length);
      client.channels.get(general).send('List of all calendar events:');
      for (let i = 0; i < json.length; i++) {
        client.channels.get(general).send('```'+JSON.stringify(eventsArray[i])+'```');
      }
      calDelay.resolve(eventsArray);
		}).catch(err => {
			console.log('Error: listAllEventsInCalendar -' + err);
      client.channels.get(general).send('```'+String(err)+'```');
		});
    return calDelay.promise
}

//Clean function deletes messages from channel
function clean(delChannel) {
  var deferred = defer();
  delChannel.fetchMessages({ limit: 100 })
  .then(messages => {
    console.log(`Deleting ${messages.size} messages`);
    if (messages.size < 2) {
      delChannel.send('cleaning');
      deferred.resolve(2);
      clean(delChannel);
    }
    if (messages.size == 100) { //maxes out at 50 (why?) so recursively delete in blocks of 50
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
function createWeek(thisChannel) {
  guilddbString = 'D:/niles/stores/' + String(thisChannel.guild.id) + 'db.json';
  gdb = require(guilddbString);
  var c1 = defer();
  var dayMap = map_days(thisChannel.guild.id);
  var nextkey = 0;
  //Create separate code block for each day
  for (let i = 0; i < 7; i++) {
    var key = 'day' + String(i);
    sendString = '**' + checkDay(dayMap[i].getDay()) + ' : **' + checkMonth(dayMap[i].getMonth()) + ' ' + dayMap[i].getDate() + '\n';
    if (gdb[key] == '[]' || gdb[key] == [] || gdb[key] == 0) {
      sendString += '```  ```';
      thisChannel.send(sendString).then( sent => {
        gdb['dayid' + String(nextkey)] = sent.id;
        nextkey++;
        })
      }
      else {
        sendString += '```';
        //Map events for each day
        for (let m = 0; m < gdb[key].length; m++) {
          tempStartDate = new Date(gdb[key][m]["start"]["dateTime"]);
          tempStartDate = convertDate(tempStartDate,thisChannel.guild.id);
          tempFinDate = new Date(gdb[key][m]["end"]["dateTime"]);
          tempFinDate = convertDate(tempFinDate,thisChannel.guild.id);
          sendString += '\n - ';
          sendString += stringPrefix(parseInt(tempStartDate.getHours())) + '-' + stringPrefixSuffix(parseInt(tempFinDate.getHours()));
          sendString += gdb[key][m]["summary"];
        }
        sendString += '```';
        thisChannel.send(sendString).then( sent => {
          gdb['dayid' + String(nextkey)] = sent.id;
          nextkey++;
        })
      }
    };
    thisChannel.send({
        embed: new discord.RichEmbed()
            .setColor('BLUE')
            .setTitle('Use ``!create`` and ``!delete`` to add and remove events')
            .setDescription('For more information use ``!help``')
            .setFooter('Note: The calendar may not update properly, run ``!update`` and then ``!display`` to manually update the calendar')
    })
  .then(confirm => {
    console.log('channel schedule updated');
    //write the init message IDs to the DB
    fs.writeFile(guilddbString, JSON.stringify(gdb, '', '\t'), (err) => {
      if (err)
        return console.log(Date() + 'createGuild error: ' + err);
      });
  })
  .catch(err => {
    console.log(err);
    c1.reject(new Error ('encountered an error in createWeek()'));
  })
  return c1.promise
}

function updateWeek(message) {
  guilddbString = 'D:/niles/stores/' + String(message.guild.id) + 'db.json';
  gdb = require(guilddbString);
  var dayMap = map_days(message.guild.id);
  var nextkey = 0;
  for (let i = 0; i < 7; i++) {
    msgId = gdb['dayid'+String(i)];
    message.channel.fetchMessage(msgId).then( m => {
      sendString = '**' + checkDay(dayMap[i].getDay()) + ' : **' + checkMonth(dayMap[i].getMonth()) + ' ' + dayMap[i].getDate() + '\n';
      if (gdb['day'+String(i)] == '[]' || gdb['day'+String(i)] == [] || gdb['day'+String(i)] == 0) {
        sendString += '```  ```';
        m.edit(sendString);
      }
      else {
        sendString += '```';
        //Map events for each day
        for (let m = 0; m < gdb['day'+String(i)].length; m++) {
          tempDate = new Date(gdb['day'+String(i)][m]["start"]["dateTime"]);
          tempStartDate = new Date(gdb['day'+String(i)][m]["start"]["dateTime"]);
          tempStartDate = convertDate(tempStartDate,message.guild.id);
          tempFinDate = new Date(gdb['day'+String(i)][m]["end"]["dateTime"]);
          tempFinDate = convertDate(tempFinDate,message.guild.id);
          sendString += '\n - ';
          sendString += stringPrefix(parseInt(tempStartDate.getHours())) + '-' + stringPrefixSuffix(parseInt(tempFinDate.getHours()));
          sendString += gdb['day'+String(i)][m]["summary"];
        }
        sendString += '```';
        m.edit(sendString);
      }
    }).catch (err => console.log(err));
  }
  message.channel.fetchMessage(message.id).then ( cmd => {
    cmd.delete(3000);
  }).catch (err => console.log(err));
  console.log('calendarUpdate');
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

//map next 7 dates in array
function map_days(guildid) {
  var day_map = [];
  var d = new Date();
  var nd = convertDate(d,guildid);
  day_map[0] = new Date(nd);
  for (let i = 1; i < 7; i++) {
    day_map[i] = new Date(nd.setDate(nd.getDate() + 1));
  }
  return day_map;
}



//create events using strict format - not working well - using google add
function createEvent(name, day, time, calendarId) {
  dateLookUp = upDays();
  let newEvent = {
    'start': { 'dateTime': String(dateLookUp[day.toLowerCase()]) + 'T' + time + ':00:00+' + process.env.TIMEZONE.split('+')[1] },
    'start': { 'dateTime': String(dateLookUp[day.toLowerCase()]) + 'T' + (time+1) + ':00:00+' + process.env.TIMEZONE.split('+')[1] },
    'summary': name
  };
  cal.Events.insert(calendarId, newEvent)
  .then(resp => {
    client.channels.get(general).send('inserted event:');
    console.log('Event inserted: ' + resp);
    client.channels.get(general).send(resp);
  })
  .catch(err => {
    console.log('Error: insertEvent- ' + err);
    client.channels.get(general).send('Could not insert event.')
  })
}

//quick add event using google text processing
function quickAddEvent(text, calendarId) {
	let params = {
		'text': text
	}
	cal.Events.quickAdd(calendarId, params)
		.then(resp => {
			let json = resp;
			console.log('inserted quickAddEvent:');
			console.log(json);
		})
		.catch(err => {
			console.log('Error: quickAddEvent-' + err);
		});
}

//Search for events on google calendar and push to JSON file
function generateEvents(guild, calendarId) {
  guilddbString = 'D:/niles/stores/' + String(guild.id) + 'db.json';
  gdb = require(guilddbString);
  var dayMap = map_days(guild.id);
  let allEvents = [];
  let params = {
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
        tempDate = new Date(allEvents[j].start['dateTime'].split('T')[0]);

        if ((dayMap[day].getFullYear() == tempDate.getFullYear() && dayMap[day].getMonth() == tempDate.getMonth() && dayMap[day].getDate() == tempDate.getDate())) {
          matches.push(allEvents[j]);
        }
      }
      gdb[key] = matches;
    }
    fs.writeFile(guilddbString, JSON.stringify(gdb, '', '\t'), (err) => {
      if (err)
        return console.log(Date() + 'createEvents() error: ' + err);
    })}).catch(err => {
  console.log('Error: createEvents -' + err);
});
}

//Find eventId from search string
//This needs better handling of incorrect commands, i.e. '8' instead of '8pm' does nothing
function deleteFindEvent(message, calendarId) {
  guilddbString = 'D:/niles/stores/' + String(message.guild.id) + 'db.json';
  gdb = require(guilddbString);
  var dayDate;
  var delDate;
  var days = map_days(message.guild.id);
  var dTime;
  var keyID;
  var gcalID;
  pieces = message.content.split(' ');
  var day = firstUpper(pieces[1].toLowerCase());
  var time = pieces[2].toLowerCase();

  for (let i = 0; i < 7; i++) {
    if(checkDay(days[i].getDay()) === day) {
      dayDate = new Date(days[i]);
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
    if (time.trim('a')[0].length == 2) {
      dTime = time.trim('a')[0];
    }
    if (time.trim('a')[0].length == 1) {
      dTime = '0' + time.trim('a')[0];
    }
  }
  //NEED TO SIMPLIFY THIS NOW THAT ITS A DATE COMPARISON
  var tzone = (guilddb[message.guild.id]["timezone"]).split('T')[1];
  delDate = dayDate.getFullYear()+'-'+ prependZero(dayDate.getMonth()+1) + '-' + prependZero(dayDate.getDate()) + 'T' + dTime + ':00:00'+tzone;
  var key = 'day' + String(keyID);
  for (let j = 0; j < gdb[key].length; j++) {
    comp1 = new Date(gdb[key][j]["start"]["dateTime"]);
    comp2 = new Date(delDate);
    if((comp1 - comp2) < 100) {
      message.channel.send('Are you sure you want to delete the event: ' + '`'+ gdb[key][j]["summary"] + '` ' + 'on ' + day + ' at ' + time + ' ? **(y/n)**');
      const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, { time: 30000 });
      collector.on('collect',(m) => {
        if(m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'yes') {
          deleteEvent(gdb[key][j]["id"], calendarId).then( del => {
            message.channel.send('Event deleted');
            generateEvents(message.guild, calendarId);
          })
        } else {
          message.channel.send('Okay, I won\'t do that');
          };
          return collector.stop();
        });
        collector.on('end', (collected, reason) => {
          if (reason === 'time')
            message.channel.send('Command response timeout');
          });
        return;
      }
    }
    message.channel.send('I couldn\'t find that event, try again!');
  }

//delete gcal events by ID
function deleteEvent(eventId, calendarId) {
	let params = {
		sendNotifications: true
	};
	return cal.Events.delete(calendarId, eventId, params)
		.then(resp => {
			console.log('Deleted Event Response: ');
			console.log(resp);
		})
		.catch(err => {
			console.log('Error: deleteEvent-' + err);
		});
}

// ********** HELPER FUNCTIONS ************ //
//functions for generating message formatting
function stringPrefix(hour) {
  var timePieces = ['12','1','2','3','4','5','6','7','8','9','10','11','12','1','2','3','4','5','6','7','8','9','10','11'];
    return timePieces[hour];
}
function stringPrefixSuffix(hour) {
  var timePieces = ['12 AM: | ','1 AM:  | ','2 AM:   | ','3 AM:   | ','4 AM:   | ','5 AM:   | ','6 AM:   | ','7 AM:   | ','8 AM:   | ','9 AM:   | ',
  '10 AM:  | ','11 AM: | ','12 PM: | ','1 PM:  | ','2 PM:   | ','3 PM:   | ','4 PM:   | ','5 PM:   | ','6 PM:   | ','7 PM:   | ','8 PM:   | ','9 PM:   | ','10 PM:  | ','11 PM: | '];
    return timePieces[hour];
}

//make first letter uppercase
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
