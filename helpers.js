// const bot = require("./bot");
// require("./models/player.model");
// const mongoose = require("mongoose");

// const Player = mongoose.model("players");

module.exports = {
  debug(obj) {
    return JSON.stringify(obj, null, 4);
  },

  getChatId(msg) {
    return msg.chat.id;
  },
  shuffle(array) {
    let currentIndex = array.length,
      randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }

    return array;
  },
};
