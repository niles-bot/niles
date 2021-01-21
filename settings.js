const secrets = require("./config/secrets.json");
const fs = require("fs");
const {google} = require("googleapis");

const SA_KEYPATH = secrets.service_acct_keypath;
const SA_JSON = JSON.parse(fs.readFileSync(SA_KEYPATH, "utf8"));
const keyFileAuth = new google.auth.GoogleAuth({
  keyFile: SA_KEYPATH,
  scopes: ["https://www.googleapis.com/auth/calendar.events"]
});

const OAUTH_KEYPATH = secrets.oauth_acct_keypath;
let oauthJson = fs.readFileSync(OAUTH_KEYPATH, "utf8");
let oauthKey = JSON.parse(oauthJson).installed;

const {client_secret, client_id, redirect_uris} = oauthKey;
const oAuth2Client = new google.auth.OAuth2(
  client_id, client_secret, redirect_uris[0]
);

module.exports = {
  secrets,
  saId: SA_JSON.client_email || "", 
  oauth2: (fs.existsSync(OAUTH_KEYPATH) ? oAuth2Client : false),
  sa: (fs.existsSync(SA_KEYPATH) ? keyFileAuth : false)
};
