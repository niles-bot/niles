let secrets = require("./secrets.json");
let fs = require("fs");

const SERVICE_ACCT_ID = secrets.service_acct_id;
const KEYPATH = secrets.service_acct_keypath;

let json = fs.readFileSync(KEYPATH, "utf8");
let key = JSON.parse(json).private_key;

module.exports.key = key;
module.exports.serviceAcctId = SERVICE_ACCT_ID;
module.exports.timezone = "UTC+00:00";
