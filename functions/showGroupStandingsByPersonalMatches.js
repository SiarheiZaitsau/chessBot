const { Tournament, TOURNAMENT_STATUS, GROUP_NAMES } = require("../models/tournament.model");
const { Player } = require("../models/player.model");
const helpers = require("../helpers");
const { Tiebreak } = require("../models/tiebreak.model");

module.exports = {
  async showGroupStandingsByPersonalMatches(bot, chatId, group) {
    const players = await Player.find({ group });
    const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });
    const sortedPlayers = players.sort((a, b) => {
      if (a.score === b.score) {
        return b.personalMatchesScore - a.personalMatchesScore;
      }
      return b.score > a.score ? 1 : -1;
    });
    const res = sortedPlayers
      .map((player, index) => {
        return `${index + 1}) ${player.name} ${player.score} pts ${
          player.personalMatchesScore
        } personal matches score`;
      })
      .join("\n");
    await bot.sendMessage(chatId, res);
    const groupByPersonalMatches = helpers.sameScoreAndPersonalMatchesGroupPlayers(sortedPlayers);
    let tieBreakPairs = [];
    const dbPairs = [];
    groupByPersonalMatches.forEach((players) => {
      if (players.length > 1) {
        const res = players.flatMap((player, i) => {
          return players.slice(i + 1).map((w) => {
            dbPairs.push({
              player1: player.name,
              player1Id: player._id,
              player2: w.name,
              player2Id: w.id,
            });
            return { player1: player.name, player2: w.name };
          });
        });
        tieBreakPairs.push(res);
      }
    });
    await Promise.all(
      dbPairs.map(async (pair) => {
        new Tiebreak({
          player1: pair.player1,
          player1Id: pair.player1Id,
          player2: pair.player2,
          player2Id: pair.player2Id,
        }).save();
      })
    );
    if (tieBreakPairs.length > 0) {
      tournament.status = TOURNAMENT_STATUS.TIEBREAK;
      await tournament.save();
      await bot.sendMessage(chatId, "Пары переигровок");
      const res = tieBreakPairs
        .map((players, index) => {
          return players
            .map((player) => {
              return `${player.player1} vs ${player.player2}`;
            })
            .join("\n");
        })
        .join("\n");
      await bot.sendMessage(chatId, res);
    } else {
      tournament.status = TOURNAMENT_STATUS.PLAYOFF;
      await tournament.save();
      bot.sendMessage(chatId, "Групповая стадия успешно завершена ГЛ в плейофе");
      await Promise.all(
        sortedPlayers.map(async (player, index) => {
          await Player.findOneAndUpdate({ _id: player._id }, { $set: { groupPlace: index + 1 } });
        })
      );
    }
  },
};
