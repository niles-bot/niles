module.exports = {
  name: "ping",
  description: true,
  preSetup: true,
  execute(message, args) {
    args;
    message.channel.send(`:ping_pong: !Pong! ${(message.client.ws.ping).toFixed(0)}ms`);
  }
};