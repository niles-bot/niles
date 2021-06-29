const { parentPort } = require("worker_threads");
const { getIterator } = require("../handlers/updaterList.js");
const debug = require("debug")("niles:updater-worker");
const util = require("util");
const sleep = util.promisify(setTimeout);

/**
 * Start iterated updater to send to parent
 */
async function start() {
  for (const result of getIterator()) {
    await sleep(1000); // delay
    parentPort.postMessage(result);
    debug(util.inspect(`sent guild: ${result.guild} channel: ${result.channel}`));
  }
  process.exit(0);
}
start();
