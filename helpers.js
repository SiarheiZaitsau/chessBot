module.exports = {
  debug(obj) {
    return JSON.stringify(obj, null, 4);
  },
  logStart() {
    console.log("bot has been started");
  },
  getChatId(msg) {
    return msg.chat.id;
  },
};
