const { Guild } = require("./guilds.js");
const fs = require("fs");
const { sidecarUpdater } = require("./commands.js");
const log = require("debug")("niles:sidecar");
var path = require('path');
const fastify = require("fastify")({
  logger: true
});

const fileNames = {
  todo: path.join("..", "todo.txt"),
  error: path.join("..", "error.txt"),
  done: path.join("..", "done.txt")
};

/**
 * Append line to file
 * @param {*} file 
 * @param {*} guild 
 * @param {*} channel 
 */
function append(file, guild, channel) {
  fs.appendFileSync(fileNames[file], `${guild},${channel}\n`);
}

/**
 * pop first line and write file without first line
 * @param {String} file 
 */
function pop(file) {
  fs.readFile(fileNames[file], "utf8", function(err, data) {
    if (err) { log(`error: ${err}`); }
    const lines = data.split("\n");
    fs.writeFile(fileNames[file], lines.slice(1).join("\n"));
    return lines[1];
  });
}

function remove(file, string) {
  //
}

// Declare a route
fastify.get("/", function (request, reply) {
  reply.send({ hello: "world" });
});

fastify.get("/add", function (request, reply) {
  fs.appendFileSync("../stores/todo_list.txt", `${request.params.guild},${request.params.channel}\n`);
});

fastify.get("/next", function (request, reply) {
  fs.appendFileSync("../stores/done_list.txt", `${request.params.guild},${request.params.channel}\n`);
});

fastify.get("/update", function (request, reply) {
  const guild = new Guild(request.params.guild);
});

fastify.get ("/error", function (request, reply) {
  
})


// Run the server!
fastify.listen(3000, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${address}`);
});