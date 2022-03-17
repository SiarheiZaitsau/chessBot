const { Tournament, TOURNAMENT_STATUS, GROUP_NAMES } = require("../models/tournament.model");
const { Player } = require("../models/player.model");
const helpers = require("../helpers");
const showGroupStandingsByPersonalMatches = require("./showGroupStandingsByPersonalMatches");
module.exports = {
  async finishGroups(bot, chatId) {
    const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });
    const groupsNumber = tournament.groupsNumber;
    const groups = GROUP_NAMES.slice(0, groupsNumber);
    if (!tournament || tournament?.status !== TOURNAMENT_STATUS.GROUPS) {
      bot.sendMessage(chatId, "Групповая стадия не активна");
    } else {
      const players = [];
      for (const group of groups) {
        const res = await Player.find({ group: group });
        players.push({
          group: group,
          players: res,
        });
      }
      for (const player of players) {
        await helpers.countPersonalMatches(helpers.sameScoreGroupPlayers(player.players));
        await showGroupStandingsByPersonalMatches.showGroupStandingsByPersonalMatches(
          bot,
          chatId,
          player.group
        );
      }
      await helpers.createBracket(chatId, 8);
      bot.sendMessage(chatId, "Групповая стадия успешно завершена ГЛ В ПЛЕЙОФЕ");
    }
  },
};
