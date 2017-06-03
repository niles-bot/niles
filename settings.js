// CalendarAPI settings
var dotenv = require('dotenv');
dotenv.load();

const SERVICE_ACCT_ID = process.env.SERVICE_ACCT_ID;
const CALENDAR_ID = {
  'primary': process.env.CALENDAR_ID,
  'calendar-1': process.env.CALENDAR_ID,
};
const TIMEZONE = process.env.TIMEZONE;

var fs = require('fs');
const KEYPATH = process.env.KEYPATH;
var json = fs.readFileSync(KEYPATH, 'utf8');
var key = JSON.parse(json).private_key;
module.exports.key = key;

module.exports.serviceAcctId = SERVICE_ACCT_ID;
module.exports.calendarId = CALENDAR_ID;
module.exports.timezone = TIMEZONE;
