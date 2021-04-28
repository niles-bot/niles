const { parentPort } = require("worker_threads");
const { getIterator } = require("../handlers/updaterList.js");
const util = require("util");
const sleep = util.promisify(setTimeout);

/**
 * Start updater
 */
async function start() {
  for (const result of getIterator()) {
    await sleep(3000);
    parentPort.postMessage(`worker send ${util.inspect(result)}`);
    console.log(util.inspect(result));
  }
  console.log("start 1m wait");
  await sleep(60000);
  if (parentPort) parentPort.postMessage("done");
  else process.exit(0);
}
start();


// handle receiving event
if (parentPort) {
  parentPort.once("message", (message) => {
    console.log(message);
  });
}