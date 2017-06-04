const fs = require('fs')

var emptyString = {'day 0' : [], 'day 1': [], 'day 2' : [], 'day 3': [], 'day 4' : [],
'day 5' : [], 'day 6' : [], 'day 7' : []}

var emptyString = {
	"day0": "[]",
	"day1": "[]",
	"day2": "[]",
  "day3": "[]",
  "day4": "[]",
  "day5": "[]",
  "day6": "[]"
}

exports.create = (guild) => {
  fileString = './stores/' + guild.id + 'db.json';
  fs.writeFile(fileString, JSON.stringify(emptyString, '', '\t'), (err) => {
    if (err)
      return console.log(Date() + 'createdb error: ' + err);
    });
    console.log(`db created for guild: `+ guild.id + ' on ' + new Date());
  }


//write guild_id
//write calendarId
//instruct the user to share their calendar with niles email address
//TIMEZONE
