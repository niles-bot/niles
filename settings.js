let secrets = require("./config/secrets.json");
let fs = require("fs");
const {google} = require("googleapis");

const SA_KEYPATH = secrets.service_acct_keypath;

const OAUTH_KEYPATH = secrets.oauth_acct_keypath;
let oauth_json = fs.readFileSync(OAUTH_KEYPATH, "utf8");
let oauth_key = JSON.parse(oauth_json).installed;

const {client_secret, client_id, redirect_uris} = oauth_key;
const oAuth2Client = new google.auth.OAuth2(
  client_id, client_secret, redirect_uris[0]);

const keyFileAuth = new google.auth.GoogleAuth({
  keyFile: SA_KEYPATH,
  scopes: ["https://www.googleapis.com/auth/calendar.events"]
});

module.exports = {
  secrets: secrets,
  oauth2: oAuth2Client,
  sa: keyFileAuth
};
