const { Player } = require("../models/player.model");
const helpers = require("../helpers");
module.exports = {
  async showFinalStandings(bot, chatId, group) {
    const players = await Player.find({ group });

    const randomNumbers = helpers.generateRandomNumbers();
    const randomResults = [];
    let i = 0;
    const sortedPlayers = players.sort((a, b) => {
      if (a.score === b.score) {
        if (a.personalMatchesScore === b.personalMatchesScore) {
          if (a.tiebreakScore === b.tiebreakScore) {
            if (!a.randomNumber) {
              a.randomNumber = randomNumbers[i];

              randomResults.push({ name: a.name, value: a.randomNumber });
              i++;
            }
            if (!b.randomNumber) {
              b.randomNumber = randomNumbers[i];
              randomResults.push({ name: b.name, value: b.randomNumber });
              i++;
            }
            return a.randomNumber > b.randomNumber ? -1 : 1;
          }
          return a.tiebreakScore > b.tiebreakScore ? -1 : 1;
        } else {
          return a.personalMatchesScore < b.personalMatchesScore ? 1 : -1;
        }
      } else {
        return a.score < b.score ? 1 : -1;
      }
    });
    const firstMessage = randomResults
      .map((player) => `Random number for ${player.name} is ${player.value}`)
      .join("\n");

    const secondMessage = sortedPlayers
      .map(
        (player, index) =>
          `${index + 1}) ${player.name} ${player.score} pts | ${
            player.personalMatchesScore
          } personal matches score | ${player.tiebreakScore} tiebreak score |  ${
            player.randomNumber ? `${player.randomNumber} random score` : ""
          }`
      )
      .join("\n");
    await bot.sendMessage(chatId, firstMessage);
    await bot.sendMessage(chatId, secondMessage);
    await Promise.all(
      sortedPlayers.map(async (player, index) => {
        await Player.findOneAndUpdate({ _id: player._id }, { $set: { groupPlace: index + 1 } });
      })
    );
  },
};
