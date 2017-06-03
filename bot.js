//Use cluster
var cluster = require ('cluster');
var dotenv = require('dotenv');
const util = require('util');
dotenv.load();
//Discord Settings
const discord = require('discord.js');1
const client = new discord.Client();
const token = process.env.BOT_TOKEN;
var general = process.env.CHANNEL_TOKEN; //NEED TO AUTO GENERATE THIS or CREATE SPECIFIC CHANNEL
//Google API Settings
const CONFIG = require('./settings.js');
const CalendarAPI = require('node-google-calendar');
let cal = new CalendarAPI(CONFIG);
var calendarId = process.env.CALENDAR_ID;

//use cluster to run workers
if (cluster.isMaster) {
    cluster.fork();
  //Log worker deaths and start new workers
  cluster.on('exit', function(worker) {
    console.log('Worker ' + worker.id + ' died...');
    cluster.fork();
  });
} else {
  //On-connect settings
  client.on('ready', () => {
    console.log('Bot is logged in using worker '+ cluster.worker.id);
    console.log('-------------------------------------------------');
    client.user.setStatus('online');
    //client.user.setGame();
    client.channels.get(general).send('Hello! Niles checking in for service.');
  });

  //message event handler
  client.on('message', message => {
    if (message.content === '!init') {
      clean(message.channel)
      .then( createWeek(message.channel)
      ).then(finished => {
        console.log('command !init finished running')
      })
      .catch(err => {
        message.channel.send('Could not initialise week array');
        console.log(err);
      });
    }
    if (message.content === '!update') {
      updateEvents();
      message.channel.send('Okay I\'ve fetched updated new events... now run ``!init`` again to update the array, I\'ll learn to do this automatically soon :( ');
    }
    if (message.content === '!all') {
      listAllEventsInCalendar(calendarId);
    }
    if (message.content.startsWith('!clean')) {
      clean(message.channel);
    }
    if (message.content.startsWith('!restart')) {
      message.channel.send('Okay... I\'ll be back in a moment.')
      .then(restart => process.exit(1))
    }
    if (message.content.startsWith('!fill')) {
      fill_with_shit(parseInt(message.content.split(' ')[1]));
    }
    if (message.content.startsWith('!create')) {
      pieces = message.content.split(' ');
      console.log(pieces[1].trim(),pieces[2].trim(),pieces[3].trim());
      createEvent(pieces[1].trim(),pieces[2].trim(),pieces[3].trim());
    }
    if (message.content.startsWith('!quickadd')) {
      pieces = message.content.split(' ');
      stringToSend = '';
      for (let it = 1; it < pieces.length ; it ++) {
        stringToSend += pieces[it];
        stringToSend += ' ';
      }
      console.log(stringToSend);
      quickAddEvent(stringToSend);
    }
    if (message.content === '!help') {
      message.author.send(HELP_MESSAGE);
    }
  });
  // Log In
  client.login(token);
  //restart bot on uncaught exceptions
  process.on('uncaughtException', function(err){
    client.channels.get(general).send('I\'ve hit an unexpected error, restarting!').then(err => {
      console.log(err);
      process.exit(1);
    })
  })
}

//Static assign weekEvents on bot start up - need to do this to handle async commands apparently
var weekEvents = generateEvents();

/// HELP MESSAGE ////
const HELP_MESSAGE = "```\
        Niles Usage\n\
---------------------------\n\
!init       -  Deletes all messages in current channel and prints a week array list\n\
!clean      -  Deletes all the messages in current channel\n\
!all        -  List all events on the linked GCal\n\
!restart    -  Kill current Niles bot node worker and start a new one)\n\
!update     -  Fetch any new Google Calendar events into the backend, needs to be followed with !init to update the channel calendar\n\
!create     -  Create new 1 hour event in the form  !create <name> <day> <hour>  i.e.  !create xeno Friday 21  - !quickadd works better\n\
!quickadd   -  Creates a new event using default google text interpretation -  !quickadd <text>  i.e.  !quickadd xeno Sunday 9pm-11pm \n\
!fill       -  Fills the server with lines of sweet nothings -  !fill <number of lines> \n\
!help       -  Display this message\n\
```";

//******************************************************************************************
//***************************************FUNCTIONS******************************************
//******************************************************************************************

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
  let calDelay = Promise.defer();
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
  var deferred = Promise.defer();
  delChannel.fetchMessages()
  .then(messages => {
    console.log(`Deleting ${messages.size} messages`);
    if (messages.size < 2) {
      delChannel.send('cleaning');
      clean(delChannel);
    }
    if (messages.size == 50) { //maxes out at 50 (why?) so recursively delete in blocks of 50
      delChannel.bulkDelete(messages); //need to wait for this for a while.
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
  var c1 = Promise.defer();
    var dayMap = map_days();
    //Create separate code block for each day
    for (let i = 0; i < 7; i++) {
      sendString = '**' + checkDay(dayMap[i].getDay()) + ' : **' + checkMonth(dayMap[i].getMonth()) + ' ' + dayMap[i].getDate() + '\n';
      console.log('\ncreateWeek: events on day ' + i + ' : ' + JSON.stringify(weekEvents[i]));
      if (weekEvents[i] == 0) {
        sendString += '``` ```';
        thisChannel.send(sendString);
      }
      else {
        sendString += '```';
        //Map events for each day
        for (let m = (weekEvents[i].length-1); m != -1; m--) {
          tempDate = new Date(weekEvents[i][m]["start"]["dateTime"]);
          sendString += stringPrefix(parseInt(tempDate.getHours()));
          sendString += weekEvents[i][m]["summary"];
        }
        sendString += '```';
        thisChannel.send(sendString);
      }
    } c1.resolve(1);
    thisChannel.send('\nuse ``!help`` for current commands list')
  .then(confirm => {
    console.log('channel schedule updated');
  })
  .catch(err => {
    console.log(err);
    c1.reject(new Error ('encountered an error in createWeek()'));
  })
  return c1.promise
}

//Returns events on day of week indicated by day
function matchDay(calendarId, day) {
  var mday = Promise.defer();
  var dayMap = map_days();
  let eventsArray = [];
  let matchingArray = [];
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
				eventsArray.push(event);
			}
      for (let i = 0; i < json.length; i++) {
        tempDate = new Date(eventsArray[i].start["dateTime"].split('T')[0]);
        if ((dayMap[day].getFullYear() == tempDate.getFullYear() && dayMap[day].getMonth() == tempDate.getMonth() && dayMap[day].getDate() == tempDate.getDate())){
          //Can you do comparison if there is a time? if not maybe build onDay() function / comparitor or something
          matchingArray.push(eventsArray[i]);
        }
      }
      return matchingArray;
		}).then(matchingArray => {
      mday.resolve(matchingArray);
    }).catch(err => {
			console.log('Error: matchDay -' + err);
      client.channels.get(general).send('```'+String(err)+'```');
      mday.reject(new Error ('encountered an error in matchDay'));
		});
    return mday.promise
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
  today = new Date(); //uses host machine, need to change to ENV timezone
  day_map[0] = new Date(today);
  for (let i = 1; i < 7; i++) {
    day_map[i] = new Date(today.setDate(today.getDate() + 1));
  }
  return day_map;
}

//generate array of this weeks events
function generateEvents() {
  let thisWeeksEvents = [];
  for (let i = 0; i < 7 ; i++) {
    matchDay(calendarId,i).then(ok => {
      thisWeeksEvents[i] = ok;
    }).catch(err => {
			console.log('Error: generateEvents -' + err);
		});
  }
  thisWeeksEvents[7] = new Date();
return thisWeeksEvents
}

//update static event array for createWeek process - async issue
function updateEvents() {
  weekEvents = generateEvents();
  console.log('events array updated at ' + weekEvents[7].toString());
}

//generate formatting prefixes
function stringPrefix(hour) {
  var timePieces = ['\n - 12-1 AM:   | ' ,'\n - 1-2 AM:   | ' ,'\n - 2-3 AM:   | ' ,'\n - 3-4 AM:   | ' ,'\n - 4-5 AM:   | ' , '\n - 5-6 AM:   | ' , '\n - 6-7 AM:   | ' ,
  '\n - 7-8 AM:   | ' ,'\n - 8-9 AM:   | ' ,'\n - 9-10 AM:  | ' ,'\n - 10-11 AM: | ' , '\n - 11-12 AM: | ' , '\n - 12-1 PM:   | ' , '\n - 1-2 PM:   | ' , '\n - 2-3 PM:   | ' ,
  '\n - 3-4 PM:   | ' ,'\n - 4-5 PM:   | ' ,'\n - 5-6 PM:   | ' ,'\n - 6-7 PM:   | ' ,'\n - 7-8 PM:   | ' ,'\n - 8-9 PM:   | ' ,'\n - 9-10 PM:  | ' , '\n - 10-11 PM: | ' , '\n - 11-12 PM: | '];
    return timePieces[hour];
}

//Create key:value pairs for upcoming week
function upDays() {
  var dayMap = map_days();
  let days = {};
  days['sunday'] = JSON.stringify(dayMap[0]).split('T')[0];
  days['monday'] = JSON.stringify(dayMap[1]).split('T')[0];
  days['tuesday'] = JSON.stringify(dayMap[2]).split('T')[0];
  days['wednesday'] = JSON.stringify(dayMap[3]).split('T')[0];
  days['thursday'] = JSON.stringify(dayMap[4]).split('T')[0];
  days['friday'] = JSON.stringify(dayMap[5]).split('T')[0];
  days['saturday'] = JSON.stringify(dayMap[6]).split('T')[0];
  return days;
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

//dummy function to fill the server with shit to test cleaning
function fill_with_shit(n) {
  for (let i = 0; i < n; i++) {
    client.channels.get(general).send('shit line number ' + i);
  }
}
