const secrets = require("./config/secrets.json");
const fs = require("fs");
const {google} = require("googleapis");

let keyFileAuth = false;
let saId = "";
try {
  const SA_KEYPATH = secrets.service_acct_keypath;
  const SA_JSON = JSON.parse(fs.readFileSync(SA_KEYPATH, "utf8"));
  saId = SA_JSON.client_email;
  keyFileAuth = new google.auth.GoogleAuth({
    keyFile: SA_KEYPATH,
    scopes: ["https://www.googleapis.com/auth/calendar.events"]
  });
} catch (err) { console.log(`Error fetching Service Account: ${err}`);
}

let oAuth2Client = false;
try {
  const OAUTH_KEYPATH = secrets.oauth_acct_keypath;
  let oauthJson = fs.readFileSync(OAUTH_KEYPATH, "utf8");
  let oauthKey = JSON.parse(oauthJson).installed;
  const {client_secret, client_id, redirect_uris} = oauthKey;
  oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
} catch (err) { console.log(`Error fetching OAuth2: ${err}`);
}

module.exports = {
  secrets,
  saId, 
  oauth2: oAuth2Client,
  sa: keyFileAuth
};
