const snekfetch = require('snekfetch');
const fs = require('fs');

exports.create = (guild) => {
  guilddb[guild.id] = '!';
  fs.writeFile('./stores/guilddb.json', JSON.stringify(guilddb, '', '\t'), (err) => {
    if (err)
      return console.log(Date() + 'createGuild error: ' + err);
});
guild.defaultChannel.send(`Hello, I'm ${client.user.username} and I'm ready to serve you. To see a list of my commands, send ``!help``. DM Sean#8856 for more info`);
}

exports.delete = (guild) => {
  delete guilddb[guild.id];
  fs.writeFile('./stores/guilddb.json', JSON.stringify(guilddb, '','\t'), (err) => {
    if (err)
      return console.log(Date() + ' deleteGuilde error: ' + err);
  });
}

//First time initialisation guilds.init(message)
////////************* THIS DOESNT WORK **************////////////
exports.init = (message) => {
  let allMsgs = [];
  allMsgs.push(message);

  message.author.send('Hey, it looks like you haven\'t set me up yet, do you want to run through the setup now?')
  .then((m) => allMsgs.push(m));

  const collector1 = message.channel.createMessageCollector((c) => message.author.id === c.author.id, { time: 30000});

  let step = 1,
    info = {
      'calendarChannel': undefined,
      'calendarId': undefined,
      'timezone': undefined
    };

  collector1.on('collect', (c) => {
    if (c.content.toLowerCase() === 'cancel') {
      return collector1.stop();
    };
    if (c.content.toLowerCase() === 'y' || c.content.toLowerCase() === 'yes') {
      message.author.send('Alrighty, type `cancel` at any time to stop the setup')
      .then((a) => allMsgs.push(a));
    };
    if (step === 1) {
      message.author.send('Enter the name of the channel you want to use: \n_(Note: A new channel with this name will be created)_');
      if (c.content.length === 0)
        return message.author.send('The channel name cannot be empty.');

      info.calendarChannel = c.content;

      message.author.send('Enter your google calendar ID')//want to include a puush or something
      .then((a) => allMsgs.push(a));
    };
    if (step === 2) {
      if (c.content.length === 0)
        return message.author.send('calendarID cannot be empty') // but it can

      info.calendarId = c.content;

      message.author.send('Enter your preferred timezone in hours relative to GMT i.e. `+8:00`')
      .then((a) => allMsgs.push(a));
    }
    if (step === 3) {
      if (c.content.length === 0)
        return message.author.send('Please enter a timezone')

      info.timezone = c.content;
      collector.stop();
      guilddb[c.guild.id] = info;
      fs.writeFile('./stores/guilddb.json', JSON.stringify(guilddb, '', '\t'), (err) => {
        if (err)
          return console.log(Date() + 'createGuild error: ' + err);
        });
      };
      step++;
    });
    collector1.on('end', (collected, reason) => {
      if (reason === 'time') {

        message.author.send('Prompt timeout');
      }
    });
  }
