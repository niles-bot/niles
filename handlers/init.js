const fs = require('fs');
guilddb = require('../stores/guilddb.json');
const commands = require('./handlers/commands.js');
const HELP_MESSAGE = "```\
        Niles Usage\n\
---------------------------\n\
NOTE - THE FULL LIST OF COMMANDS WILL NOT FUNCTION UNTIL GOOGLE CALENDAR ID IS ENTERED\n\
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

exports.run = async function(message) {
  //PREFIX
  if (commands.mentioned(message, 'prefix'))
    message.channel.send(`My prefix in this server is \`${guilddb[message.guild.id]["prefix"]}\`.`);
  if(!guilddb[message.guild.id]["prefix"])
    guildb[message.guild.id]["prefix"] = '!';
  const cmd = message.content.toLowerCase().substring(guilddb[message.guild.id]["prefix"].length).split(' ')[0];
  console.log(cmd);
  //ping
  if (cmd === 'ping' || commands.mentioned(message, 'ping'))
      message.channel.send(`:ping_pong: Pong! ${client.pings[0]}ms`);
  //help
  if (cmd === 'help' || commands.mentioned(message, 'help'))
    message.author.send(HELP_MESSAGE);
  //Print setup Instructions
  if (['setup','init'].includes(cmd) || commands.mentioned(message, ['setup','init'])) {
    message.channel.send('On the settings page for the Google calendar you would like to use, under \'Share with specific people\', invite the service account for Niles:\
``niles-291@niles-169605.iam.gserviceaccount.com`` then use the following commands to complete setup:\n\
``!id`` <calendarID> to enter your google calendar ID\n``!tz`` <timezone> to enter your timezone, in the form ``GMT+10:00`` (currently must use GMT and maintain full form)');
  }
  //Entering the Google Calendar ID
  if (cmd === 'id' || commands.mentioned (message, 'id')) {
    calID = message.content.split(' ')[1];
    if (message.content.indexOf('@') == -1) {
      message.channel.send('I don\'t think that\'s a valid calendar ID... try again');
      return;
    }
    if (guilddb[message.guild.id]["calendarID"] != "") {
      message.channel.send('I\'ve already been setup to use ``' + guilddb[message.guild.id]["calendarID"] + '`` as the calendar ID in this server, do you want to overwrite and set the ID to: ``' + calID + '``? **(y/n)**');
      const collector = message.channel.createMessageCollector((m) => message.author.id === m.author.id, { time: 30000});
      collector.on('collect', (m) => {
        if(m.content.toLowerCase() === 'y' || m.content.toLowerCase() === 'yes') {
          guilddb[message.guild.id]["calendarID"] = calID;
          message.channel.send('Okay, I\'m adding your calendar ID as ``' + calID + '``');
          commands.writeGuilddb(guilddb);
        } else {
          message.channel.send('Okay, I won\'t do that');
        };
        return collector.stop();
      });
      collector.on('end', (collected, reason) => {
        if (reason === 'time')
          message.channel.send('Command response timeout');
        });
      } else {
        calID = message.content.split(' ')[1];
        guilddb[message.guild.id]["calendarID"] = calID;
        message.channel.send('Okay, I\'m adding your calendar ID as ``' + calID + '``');
        commands.writeGuilddb(guilddb);
      }
    }
    //Entering the Timezone
    if (cmd === 'tz' || commands.mentioned(message, 'tz')) {
      if (message.content.split(' ')[1] == undefined) {
        message.channel.send('Please enter timezone in valid format, i.e. ``GMT+06:00``');
        return
      } else {
        tz = message.content.split(' ')[1].toUpperCase().trim();
        if (tz.indexOf('+') === -1 && tz.indexOf('-') === -1) {
          message.channel.send('Please enter timezone in valid format, i.e. ``GMT+06:00``');
          return
        }
        if (tz.indexOf('GMT') == -1) {
          message.channel.send('Please enter timezone in valid format, i.e. ``GMT+06:00``, please note this currently requires GMT');
          return
        }
        if (tz.length != 9) {
          message.channel.send('Please enter timezone in valid format, i.e. ``GMT+06:00``');
          return
        } else {
          guilddb[message.guild.id]["timezone"] = tz;
          message.channel.send('Okay, I\'m adding your timezone as ``' + tz + '``');
          commands.writeGuilddb(guilddb);
        }
      }
    }
  }
