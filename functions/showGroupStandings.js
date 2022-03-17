const { Player } = require("../models/player.model");

module.exports = {
  async showStandings(bot, chatId, group) {
    console.log("1");
    const players = await Player.find({ group });
    await bot.sendMessage(chatId, `group ${group}`);
    const sortedPlayers = players.sort((b, a) => {
      return a.score - b.score;
    });
    const res = sortedPlayers
      .map((player, index) => {
        return `${index + 1}) ${player.name} ${player.score}pts`;
      })
      .join("\n");
    await bot.sendMessage(chatId, res);
  },
};
