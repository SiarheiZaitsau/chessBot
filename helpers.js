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
  generateRandomNumbers(players, f) {
    const numbers = Array(100)
      .fill()
      .map((_, index) => index + 1);
    numbers.sort(() => Math.random() - 0.5);
    return numbers;
  },
  groupByScore: groupByScore,

  sameScoreGroupPlayers: (group) =>
    groupByScore(group, function (player) {
      return [player.score];
    }),
  sameScoreAndPersonalMatchesGroupPlayers: (group) =>
    groupByScore(group, function (player) {
      return [player.score, player.personalMatchesScore];
    }),
  sameTiebreakPlayers: (group) =>
    groupByScore(group, function (player) {
      return [player.score, player.personalMatchesScore, player.tiebreakScore];
    }),
};

function groupByScore(players, f) {
  // вынести
  const groups = {};
  players.forEach(function (player) {
    const group = JSON.stringify(f(player));
    groups[group] = groups[group] || [];
    groups[group].push(player);
  });
  return Object.keys(groups).map(function (group) {
    return groups[group];
  });
}
