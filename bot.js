//Use cluster
var cluster = require ('cluster');
var dotenv = require('dotenv');
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
    client.user.setStatus('online');
    client.user.setGame('with the feather duster');
    client.channels.get(general).send('Hello! Niles checking in for service.');
  });

  //message event handler
  client.on('message', message => {
    if (message.content === '!init') {
      clean(message.channel)
      .then(create => createWeek(message.channel))
      .catch(err => {
        message.channel.send('Could not initialise week array');
        console.log(err);
      })
    }
    if (message.content === '!new') {
      createWeek(message.channel);
    }
    if (message.content === '!get') {
      get_events();
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
    if (message.content === '!help') {
      message.author.send(HELP_MESSAGE);
    }
  });
  // Log In
  client.login(token);
  //restart bot on uncaught exceptions
  process.on('uncaughtException', function(err){
    console.log(err);
    process.exit(1);
  })
}

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

//Generic Search parameters.
let params = {
	timeMin: '2017-06-05T09:00:00+08:00',
	timeMax: '2017-06-05T10:00:00+08:00',
	q: 'query term',
	singleEvents: true,
	orderBy: 'startTime'
}; 	//Optional query parameters referencing google APIs

//listallevents on the calendar
function listAllEventsInCalendar(calendarId) {
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
      client.channels.get(general).send('List of all calendar events:');
      for (let i = 0; i < json.length; i++) {
        client.channels.get(general).send('```'+JSON.stringify(eventsArray[i])+'```');
        var pieces = (JSON.stringify(eventsArray[i].start)).split(':');
        console.log(pieces[1]);
        client.channels.get(general).send('** The event starts on: ' + JSON.stringify(eventsArray[i].start) + '**');
      }
		}).catch(err => {
			console.log('Error: listAllEventsInCalendar -' + err);
      client.channels.get(general).send('```'+String(err)+'```');
		});
}

//clean function
function clean(delChannel) {
  var deferred = Promise.defer();
  delChannel.fetchMessages()
  .then(messages => {
    console.log(`Deleting ${messages.size} messages`);
    delChannel.bulkDelete(messages);
    deferred.resolve(1);
  })
  .catch(err => {
    console.log(err);
    deferred.reject(new Error ('could not clean up messages'));
  })
  return deferred.promise;
}

//create week array
function createWeek(thisChannel) {
  var deferred = Promise.defer();
  var days = ['Sunday','Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var timeString = "```\n - 6-7    | \n - 7-8:   | \n - 8-9:   | \n - 9-10:  | \n - 10-11: | \n - 11-12: |  ```";
  for (let i = 0; i < days.length; i++) {
    thisChannel.send('**' + days[i] + ':**\n'+timeString);
  }
  thisChannel.send('\nuse ``!help`` for current commands list')
  .then(confirm => {
    console.log('week array successfully created');
    deferred.resolve(1);
  })
  .catch(err => {
    console.log(err);
    deferred.reject(new Error ('encountered an error in createWeek()'));
  })
  return deferred.promise;
}

/// HELP MESSAGE ////
const HELP_MESSAGE = "```\
        Niles Usage\n\
---------------------------\n\
!init       - Deletes all messages in current channel and prints a week array list\n\
!clean      - Deletes all the messages in current channel\n\
!all        - List all events on the linked GCal\n\
!restart    - Kill current Niles bot node worker and start a new one)\n\
!help       - Display this message\n\
```";
