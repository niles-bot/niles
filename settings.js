const secrets = require("./config/secrets.json");
const fs = require("fs");
const {google} = require("googleapis");

const SA_KEYPATH = secrets.service_acct_keypath;
const keyFileAuth = new google.auth.GoogleAuth({
  keyFile: SA_KEYPATH,
  scope: ["https://www.googleapis.com/auth/calendar.events"]
});

const OAUTH_KEYPATH = secrets.oauth_acct_keypath;
let oauth_json = fs.readFileSync(OAUTH_KEYPATH, "utf8");
let oauth_key = JSON.parse(oauth_json).installed;

const {client_secret, client_id, redirect_uris} = oauth_key;
const oAuth2Client = new google.auth.OAuth2(
  client_id, client_secret, redirect_uris[0]
);

module.exports = {
  secrets: secrets,
  sa_id: secrets.serivce_acct_id,
  oauth2: (fs.existsSync(OAUTH_KEYPATH) ? oAuth2Client : false),
  sa: (fs.existsSync(SA_KEYPATH) ? keyFileAuth : false)
};
