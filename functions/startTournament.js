const { Tournament, TOURNAMENT_STATUS, GROUP_NAMES } = require("../models/tournament.model");
const { Player } = require("../models/player.model");
const helpers = require("../helpers");
module.exports = {
  async startTournament(bot, chatId, numberOfGroups) {
    const [tournament, participants] = await Promise.all([
      Tournament.findOne({}, {}, { sort: { created_at: -1 } }),
      Player.find({}),
    ]);

    if (!tournament || tournament?.status !== TOURNAMENT_STATUS.REGISTRATION) {
      bot.sendMessage(chatId, `tournament is already started or not announced`);
    } else if (participants.length < 4 || participants.length % 2 > 0) {
      bot.sendMessage(chatId, `Количество участников меньше 4х или нечетное`);
    } else {
      tournament.status = TOURNAMENT_STATUS.GROUPS;
      tournament.groupsNumber = numberOfGroups;
      const groups = GROUP_NAMES.slice(0, numberOfGroups);
      await tournament.save().then(await helpers.assignGroups(numberOfGroups));

      for (const group of groups) {
        await helpers.sendGroup(bot, chatId, group);
      }
      bot.sendMessage(chatId, `tournament has been successfully started`);
    }
  },
};
