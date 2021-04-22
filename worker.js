/** */
function send() {
  console.log(`Worker ${process.pid} sends message to master...`);
  process.send({ msg: `Message from worker ${process.pid}` });
}

/** */
function childProcess() {
  console.log(`Worker ${process.pid} started`);

  process.on("message", function(message) {
    console.log(`Worker ${process.pid} recevies message '${JSON.stringify(message)}'`);
  });
  setTimeout(send, 3000);
  console.log(`Worker ${process.pid} finished`);
}

module.exports = childProcess();