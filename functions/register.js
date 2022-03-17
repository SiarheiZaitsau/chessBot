const { Tournament, TOURNAMENT_STATUS } = require("../models/tournament.model");
const { Player } = require("../models/player.model");
const { LICHESS_API } = require("../constants");
const helpers = require("../helpers");
const axios = require("axios");
module.exports = {
  async registerPlayer(bot, chatId, query) {
    const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });

    if (tournament?.status !== TOURNAMENT_STATUS.REGISTRATION) {
      bot.sendMessage(chatId, `Sorry registration is closed`);
    } else {
      axios
        .get(`${LICHESS_API}/${query.name}`)
        .then(async function (response) {
          new Player({
            name: query.name.toLowerCase(),
          }).save();
          await bot
            .sendMessage(chatId, `user ${query.name} is successfully registered`)
            .catch((e) => {
              console.log(e);
              bot.sendMessage(chatId, `User is already exist`);
            });
          await bot.sendMessage(chatId, `Список участников:`);
          helpers.sendPlayers(bot, chatId);
        })
        .catch(function (error) {
          bot.sendMessage(chatId, `Incorrect username`);
          console.log(error);
        });
    }
  },
};
