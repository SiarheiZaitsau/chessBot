const { Tournament, TOURNAMENT_STATUS, GROUP_NAMES } = require("../models/tournament.model");
const helpers = require("../helpers");
const showFinalGroupStandings = require("./showFinalGroupStandings");
module.exports = {
  async finishTieBreaks(bot, chatId) {
    const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });
    const groupsNumber = tournament.groupsNumber;
    const groups = GROUP_NAMES.slice(0, groupsNumber);
    if (!tournament || tournament?.status !== TOURNAMENT_STATUS.TIEBREAK) {
      bot.sendMessage(chatId, "Тайбрейк стадия не активна");
    } else {
      for (const group of groups) {
        await showFinalGroupStandings.showFinalStandings(bot, chatId, group);
      }
      bot.sendMessage(chatId, "Групповая стадия успешно завершена ГЛ В ПЛЕЙОФЕ");
      await helpers.createBracket(chatId, 8);

      tournament.status = TOURNAMENT_STATUS.PLAYOFF;
      await tournament.save();
    }
  },
};
