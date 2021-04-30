const { parentPort } = require("worker_threads");
const { getIterator } = require("../handlers/updaterList.js");
const log = require("debug")("updater-worker");
const util = require("util");
const sleep = util.promisify(setTimeout);
const delay = require("../settings.js").secrets.calendar_update_interval;

/**
 * Start iterated updater to send to parent
 */
async function start() {
  for (const result of getIterator()) {
    await sleep(delay); // delay
    parentPort.postMessage(result);
    log(util.inspect(`sent ${result}`));
  }
  process.exit(0);
}
start();
