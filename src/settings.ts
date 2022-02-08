import secrets from "config/secrets.json";
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

const sa = keyFileAuth;

export {
  secrets,
  saId,
  sa
};
