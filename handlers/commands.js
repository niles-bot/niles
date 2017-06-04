const exec = require('child_process').exec;
const time = require('time-parser');
const moment = require('moment');
const fs = require('fs')
require('moment-duration-format')

//promises - need to deprecate
var defer = require('promise-defer');

const guilds = require('../handlers/guilds');

//Google API Settings
const CONFIG = require('../settings.js');
const CalendarAPI = require('node-google-calendar');
let cal = new CalendarAPI(CONFIG);
var calendarId = process.env.CALENDAR_ID;

//temporary messages
const tempMessage = require('./messages.js');
tempMessagedb = require('../stores/tempMessages.json');

exports.run = async function(message) {

  //PREFIX
  if (mentioned(message, 'prefix'))
    message.channel.send(`My prefix in this server is \`${guilddb[message.guild.id]}\`.`);

  if(!guilddb[message.guild.id])
    guildb[message.guild.id] = '!';

  const cmd = message.content.toLowerCase().substring(guilddb[message.guild.id].length).split(' ')[0];
  console.log(cmd);
  //PING
  if (cmd === 'ping' || mentioned(message, 'ping'))
      message.channel.send(`:ping_pong: Pong! ${client.pings[0]}ms`)
      .then( out => {
        name = 'ping';
        tempMessage.createDayMessage(out, name);
      })
  //EDIT - temp function testing message storage
  if (cmd ==='edit'){
    msgId = tempMessagedb[Object.keys(tempMessagedb)[0]][0];
    message.channel.fetchMessage(msgId).then( msg => {
      msg.edit('This has been edited')
    }).catch(err => console.log(err));
  }
  //DELETE BY ID FROM TEMP MESSAGE ARRAY
  if (cmd === 'deletemsgs') {
    pieces = message.content.split(' ');
    tempMessage.deleteByKey(Object.keys(tempMessagedb)[pieces[1]]);
  }
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
  //First setup
  if (cmd === 'setup' || mentioned(message, 'setup'))
    guilds.init(message);
  //INVITE
  if (cmd === 'invite' || mentioned(message, 'invite'))
        message.channel.send({
            embed: new discord.RichEmbed()
                .setColor('#FFFFF')
                .setDescription('Click [here](https://discordapp.com/oauth2/authorize?permissions=523344&scope=bot&client_id=' + client.user.id + ') to invite me to your server')
        });
  if (cmd === 'dbtest') {
    initdb = require('../handlers/init');
    initdb.create(message.guild);
  }
  //RESTART
  if (['reboot','restart','kill'].includes(cmd) || mentioned(message, ['reboot','restart','kill'])) {
    await message.channel.send('Okay... I\'ll be back in a moment.');
    await client.destroy()
    .then(restart => process.exit(1))
  }
  //INITIALISE
  if (cmd === 'init' || mentioned(message, 'init')) {
    await clean(message.channel);
    await generateEvents(message.guild);
    await createWeek(message.channel);
    await console.log('command init finished running');
  }
  //STATS
  if (['stats', 'info'].includes(cmd) || mentioned(message, ['stats', 'info'])) {
    let os = require('os'),
    embed = new discord.RichEmbed()
    .setColor('RED')
    .setTitle(`Niles Bot <ver>`)
    .setURL('https://github.com/seanecoffey/Niles')
    .addField('Servers', client.guilds.size, true)
    .addField('Uptime', moment.duration(process.uptime(), 'seconds').format('dd:hh:mm:ss'), true)
    .addField('Ping', `${(client.ping).toFixed(0)} ms`, true)
    .addField('RAM Usage', `${(process.memoryUsage().rss / 1048576).toFixed()}MB/${(os.totalmem() > 1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + ' GB' : (os.totalmem() / 1048576).toFixed() + ' MB')}
(${(process.memoryUsage().rss / os.totalmem() * 100).toFixed(2)}%)`, true)
    .addField('System Info', `${process.platform} (${process.arch})\n${(os.totalmem() > 1073741824 ? (os.totalmem() / 1073741824).toFixed(1) + ' GB' : (os.totalmem() / 1048576).toFixed(2) + ' MB')}`, true)
    .addField('Libraries', `[Discord.js](https://discord.js.org) v${discord.version}\nNode.js ${process.version}`, true)
    .addField('Links', '[Bot invite](https://discordapp.com/oauth2/authorize?permissions=523344&scope=bot&client_id=320434122344366082) | [Support server invite](https://discord.gg/jNyntBn) | [GitHub](https://github.com/seanecoffey/Niles)', true)
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
    quickAddEvent(stringToSend);
    setTimeout(generateEvents(message.guild), 30000)
    .catch(e => {
      console.log('timeout error: ' + e);
    });
  }
  if(['update', 'sync', 'refresh'].includes(cmd) || mentioned(message, ['update','sync', 'refresh'])) {
    generateEvents(message.guild);
  }
  if(cmd === 'delete') {
    deleteEvent(message)
  }
  if(cmd === 'display') {
    createWeek(message.channel);
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

//get_events using generic search params
function get_events() {
  cal.Events.list(calendarId, params)
    .then(json => {
      console.log('List of events on calendar within time-range:');
      console.log(json);
      if (json == "") {
        client.channels.get(general).send('no events found');
        console.log('no events found');
      } else {
      client.channels.get(general).send('List of events on calendar within time-range:');
      client.channels.get(general).send(String(json));
    }
    }).catch(err => {
      client.channels.get(general).send('```'+String(err)+'```');
      console.log(err);
    })
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
    var dayMap = map_days();
    //Create separate code block for each day
    for (let i = 0; i < 7; i++) {
      var key = 'day' + String(i);
      sendString = '**' + checkDay(dayMap[i].getDay()) + ' : **' + checkMonth(dayMap[i].getMonth()) + ' ' + dayMap[i].getDate() + '\n';
      if (gdb[key] == '[]' || gdb[key] == [] || gdb[key] == 0) {
        sendString += '```  ```';
        thisChannel.send(sendString);
      }
      else {
        sendString += '```';
        //Map events for each day
        for (let m = 0; m < gdb[key].length; m++) {
          tempDate = new Date(gdb[key][m]["start"]["dateTime"]);
          sendString += stringPrefix(parseInt(tempDate.getHours()));
          sendString += gdb[key][m]["summary"];
        }
        sendString += '```';
        thisChannel.send(sendString);
      }
    } c1.resolve(1);

    thisChannel.send({
        embed: new discord.RichEmbed()
            .setColor('BLUE')
            .setTitle('Use ``!create`` and ``!delete`` to add and remove events')
            .setDescription('For more information use ``!help``')
            .setFooter('Note: The calendar may not update properly, run ``!update`` and then ``!display`` to manually update the calendar')
    })
  .then(confirm => {
    console.log('channel schedule updated');
  })
  .catch(err => {
    console.log(err);
    c1.reject(new Error ('encountered an error in createWeek()'));
  })
  return c1.promise
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
function map_days() {
  var day_map = [];
  var today = new Date(); //uses host machine, need to change to ENV timezone
  day_map[0] = new Date(today);
  for (let i = 1; i < 7; i++) {
    day_map[i] = new Date(today.setDate(today.getDate() + 1));
  }
  return day_map;
}

//generate formatting prefixes
function stringPrefix(hour) {
  var timePieces = ['\n - 12-1 AM:   | ' ,'\n - 1-2 AM:   | ' ,'\n - 2-3 AM:   | ' ,'\n - 3-4 AM:   | ' ,'\n - 4-5 AM:   | ' , '\n - 5-6 AM:   | ' , '\n - 6-7 AM:   | ' ,
  '\n - 7-8 AM:   | ' ,'\n - 8-9 AM:   | ' ,'\n - 9-10 AM:  | ' ,'\n - 10-11 AM: | ' , '\n - 11-12 AM: | ' , '\n - 12-1 PM:   | ' , '\n - 1-2 PM:   | ' , '\n - 2-3 PM:   | ' ,
  '\n - 3-4 PM:   | ' ,'\n - 4-5 PM:   | ' ,'\n - 5-6 PM:   | ' ,'\n - 6-7 PM:   | ' ,'\n - 7-8 PM:   | ' ,'\n - 8-9 PM:   | ' ,'\n - 9-10 PM:  | ' , '\n - 10-11 PM: | ' , '\n - 11-12 PM: | '];
    return timePieces[hour];
}

//create events using strict format
function createEvent(name, day, time) {
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
function quickAddEvent(text) {
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

//GENERATE EVENTS
function generateEvents(guild) {
  guilddbString = 'D:/niles/stores/' + String(guild.id) + 'db.json';
  gdb = require(guilddbString);
  var dayMap = map_days();
  let allEvents = [];
  let params = {};
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
function deleteEvent(message) {
  console.log('----' + message + '---- ')
  guilddbString = 'D:/niles/stores/' + String(message.guild.id) + 'db.json';
  gdb = require(guilddbString);
  var dayDate;
  var delDate;
  var days = map_days();
  var dTime;
  var keyID
  var gcalID
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
    }
    else {
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
var tzone = (process.env.TIMEZONE).split('T')[1];
delDate = dayDate.getFullYear()+'-'+ prependZero(dayDate.getMonth()+1) + '-' + prependZero(dayDate.getDate()) + 'T' + dTime + ':00:00'+tzone;
var key = 'day' + String(keyID);
for (let j = 0; j < gdb[key].length; j++) {
  console.log(gdb[key][j]["start"]["dateTime"] + '---' + delDate);
  if(gdb[key][j]["start"]["dateTime"] === delDate) {
    //CREATE A MESSAGE CATCHER HERE TO CONFIRM THAT WE GOT THE RIGHT ONE
    console.log('captain we got a hit!');
    gcalID = gdb[key][j]["id"];
    deleteEvent(gcalID)
    .then( del => {
      message.channel.send('Deleting event: ' + '`'+ gdb[key][j]["summary"] + '` ' + 'on ' + day + ' at ' + time);
      generateEvents(message.guild);
    })
  }
}
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

//delete gcal events by ID
function deleteEvent(eventId) {
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
