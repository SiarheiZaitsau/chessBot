const { PRIZES } = require("../models/tournament.model");
module.exports = {
  async sendPrizePool(bot, chatId) {
    const res = PRIZES.map((prize, index) => {
      return `${index + 1}) ${prize}$ `;
    }).join("\n");
    await bot.sendMessage(chatId, res);
  },
};
