//Use cluster
var cluster = require ('cluster');
var dotenv = require('dotenv');
const util = require('util');
dotenv.load();
//Discord Settings
discord = require('discord.js');
client = new discord.Client();
const token = process.env.BOT_TOKEN;
var nilesSupport = process.env.CHANNEL_TOKEN; //NEED TO AUTO GENERATE THIS or CREATE SPECIFIC CHANNEL

//handlers & dbs
const commands = require('./handlers/commands.js');
const guilds = require('./handlers/guilds');
guilddb = require('./stores/guilddb.json');
const init = require('./handlers/init.js');

//use cluster to run workers - deprecate in production
if (cluster.isMaster) {
    cluster.fork();
  //Log worker deaths and start new workers
  cluster.on('exit', function(worker) {
    console.log(Date() + ' : Worker ' + worker.id + ' died...');
    cluster.fork();
  });
} else {
  //On-connect settings
  client.on('ready', () => {
    console.log(Date() + ' : Bot is logged in using worker '+ cluster.worker.id);
    console.log('-------------------------------------------------');
    client.user.setStatus('online');
    //client.user.setGame(); //can set game with !help or similar
    var d = new Date();
    client.channels.get(nilesSupport).send('Niles is online');
  });

  client.on('guildCreate', (guild) => {
    guilds.create(guild);
  });

  client.on('guildDelete', (guild) => {
    guilds.delete(guild);
  });

  //message handler
  client.on('message', (message) => {
    if (message.author.bot) return;
    if(!message.content.toLowerCase().startsWith(guilddb[message.guild.id]["prefix"]) && !message.isMentioned(client.user.id))
      return;
    if(guilddb[message.guild.id]["calendarID"] === "") {
      try {
        init.run(message);
      } catch (e) {
        console.log(e);
        return message.channel.send('Something went wrong');
      }
    } else {
      try {
        commands.run(message);
      } catch (e) {
        console.log(e);
        return message.channel.send('Something went wrong');
      }
    }
  });

  // Log In
  client.login(token);
  //restart bot on uncaught exceptions
  process.on('uncaughtException', function(err){
    var d = new Date();
    client.channels.get(nilesSupport).send('I\'ve hit an unexpected error, restarting!').then(err => {
      console.log('uncaughExceptionError: ' + err);
      process.exit(1);
    })
  })
}
