const fs = require('fs');
tempMessagedb = require('../stores/tempMessages.json');
exports.create = (tempMessage) => {
  tempMessagedb[tempMessage.id] = Date().toString();
  fs.writeFile('./stores/tempMessages.json', JSON.stringify(tempMessagedb, '', '\t'), (err) => {
    if(err)
      return console.log(Date() + 'createTempMessage error: ' + err);
  });
  console.log('temp msg successfully created: ' + tempMessage.id);
}

exports.delete = (tempMessage) => {
  delete tempMessagedb[tempMessage.id];
  fs.writeFile('./stores/tempMessages.json', JSON.stringify(tempMessagedb, '', '\t'), (err) => {
    if(err)
      return console.log(Date() + ' deleteTempMessage error: ' + err)
  });
  console.log('temporary msg ' + tempMessage.id + ' deleted');
}

exports.createDayMessage = (tempMessage, name) => {
  tempMessagedb[name] = [tempMessage.id, tempMessage.content];
  fs.writeFile('./stores/tempMessages.json', JSON.stringify(tempMessagedb, '', '\t'), (err) => {
    if(err)
      return console.log(Date() + 'createTempMessage error: ' + err);
  });
  console.log('temp msg successfully created: ' + tempMessage.id);
}

exports.deleteByRef = (id) => {
  delete tempMessagedb[Object.keys(tempMessagedb)[id]];
  fs.writeFile('./stores/tempMessages.json', JSON.stringify(tempMessagedb, '', '\t'), (err) => {
    if(err)
      return console.log(Date() + ' deleteTempMessage error: ' + err)
  });
  console.log('temporary msg ' + String(id) + ' deleted');
}

exports.deleteByKey = (key) => {
  delete tempMessagedb[key];
  fs.writeFile('./stores/tempMessages.json', JSON.stringify(tempMessagedb, '', '\t'), (err) => {
    if(err)
      return console.log(Date() + ' deleteTempMessage error: ' + err)
  });
  console.log('temporary msg ' + key + ' deleted');
}
