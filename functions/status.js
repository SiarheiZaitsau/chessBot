const {
  Tournament,
  TOURNAMENT_STATUS,
  GROUP_NAMES,
  PRIZES,
} = require("../models/tournament.model");
require("../models/tournament.model");
const { Playoff } = require("../models/playoff.model");
const showGroupStandings = require("./showGroupStandings.js");
const helpers = require("../helpers");
const { Player } = require("../models/player.model");
module.exports = {
  async showTournamentStatus(bot, chatId) {
    // rename showTournamentStatus
    const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });
    switch (tournament?.status) {
      case TOURNAMENT_STATUS.REGISTRATION:
        await bot.sendMessage(chatId, `Идет регистрация Список участников:`);
        helpers.sendPlayers(chatId);
        break;
      case TOURNAMENT_STATUS.GROUPS:
        {
          const numberOfGroups = tournament.groupsNumber;
          const groups = GROUP_NAMES.slice(0, numberOfGroups);
          console.log("2");
          bot.sendMessage(chatId, `Идет Групповая стадия турнира:`);
          for (const group of groups) {
            await showGroupStandings.showStandings(bot, chatId, group);
          }
        }
        break;
      case TOURNAMENT_STATUS.TIEBREAK:
        {
          const tiebreak = await Tiebreak.find({});
          const res = tiebreak
            .map((match, index) => {
              return `${index + 1}) ${match.player1} ${match.player1Score}:${match.player2Score} ${
                match.player2
              }`;
            })
            .join("\n");
          bot.sendMessage(chatId, "Идут Тайбрейки").then(() => bot.sendMessage(chatId, res));
        }
        break;
      case TOURNAMENT_STATUS.PLAYOFF:
        const playoff = await Playoff.find({});
        const res = playoff
          .map((match) => {
            return `stage: ${match.stage} ${match.player1 || "Соперник не определен"} ${
              match.score1 || 0
            }:${match.score2 || 0} ${match.player2 || "Соперник не определен"}`;
          })
          .join("\n");
        await bot.sendMessage(chatId, "Матчи Плей-офф");
        await bot.sendMessage(chatId, res);
        break;
      case TOURNAMENT_STATUS.COMPLETED:
        const players = await Player.find({});
        const sortedPlayers = players.sort((a, b) => (a.finalPlace > b.finalPlace ? 1 : -1));
        sendPlayers(bot, chatId, sortedPlayers);
        break;
    }
  },
};
async function sendPlayers(bot, chatId, players) {
  const res = players
    .map((player, index) => {
      return `${index + 1}) ${player.name} - ${PRIZES[index]}$ `;
    })
    .join("\n");
  await bot.sendMessage(chatId, res);
}
