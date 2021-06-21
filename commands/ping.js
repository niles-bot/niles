module.exports = {
  name: "ping",
  description: "Pong!",
  preSetup: true,
  execute(message, args) {
    args;
    message.channel.send(`:ping_pong: !Pong! ${(message.client.ws.ping).toFixed(0)}ms`);
  }
};