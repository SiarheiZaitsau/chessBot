const { Tournament, TOURNAMENT_STATUS } = require("../models/tournament.model");
module.exports = {
  async announceTournament(bot, id) {
    const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });
    if (!tournament || tournament?.status !== TOURNAMENT_STATUS.REGISTRATION) {
      await new Tournament({
        status: TOURNAMENT_STATUS.REGISTRATION,
      }).save();
      bot.sendMessage(id, "ЗДАРОВА БАНДИТЫ! турнир активирован, для регистрации пиши /register");
    } else {
      bot.sendMessage(id, "Tournament is already active");
    }
  },
};
