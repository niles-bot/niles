import secrets from "../config/secrets.json";
import { readFileSync } from "fs";
import { auth } from "@googleapis/calendar";

let keyFileAuth = null;
let saId = "";
try {
  const SA_KEYPATH = secrets.service_acct_keypath;
  const SA_JSON = JSON.parse(readFileSync(SA_KEYPATH, "utf8"));
  saId = SA_JSON.client_email;
  keyFileAuth = new auth.GoogleAuth({
    keyFile: SA_KEYPATH,
    scopes: ["https://www.googleapis.com/auth/calendar.events"]
  });
} catch (err) {
  /* eslint-disable-next-line no-console */
  console.error(`Error fetching Service Account: ${err}`);
}

let oAuth2Client = null;
try {
  const OAUTH_KEYPATH = secrets.oauth_acct_keypath;
  const oauthJson = readFileSync(OAUTH_KEYPATH, "utf8");
  const oauthKey = JSON.parse(oauthJson).installed;
  const { client_secret, client_id, redirect_uris } = oauthKey;
  oAuth2Client = new auth.OAuth2(client_id, client_secret, redirect_uris[0]);
} catch (err) {
  /* eslint-disable-next-line no-console */
  console.log(`Error fetching OAuth2: ${err}`);
}

const sa = keyFileAuth;
const oauth2 = oAuth2Client;

export {
  secrets,
  saId,
  oauth2,
  sa
};
