// const axios = require("axios");
// const TelegramBot = require("node-telegram-bot-api");
// const constants = require("../constants");
// const mongoose = require("mongoose");
// require("../models/player.model");
// const Player = mongoose.model("players");
// const token = "5075310188:AAFJJAPibPicZEzZl9M--T7ULy8kfQ6tI8A";
// const LICHESS_API = constants.LICHESS_API;
// const bot  = require('../bot');
// const realBot = bot.bot;
// console.log(realBot, 'bot import')
// module.exports = {
//   registerPlayer(chatId, query) {
//   axios
//     .get(`${LICHESS_API}/${query.name}`)
//     .then(function (response) {
//       new Player({
//         name: query.name.toLowerCase(),
//       })
//         .save()
//         .then((response) =>
//           bot.sendMessage(chatId, `user ${query.name} is succesfully registred`)
//         )
//         .catch((e) => {
//           console.log(e);
//           bot.sendMessage(chatId, `User is already exist`);
//         });
//     })
//     .catch(function (error) {
//       bot.sendMessage(chatId, `Incorrect username`);
//       console.log(error);
//     });
// },
//  sendPlayers(chatId, query) {
//   Player.find(query).then((players) => {
//     const res = players
//       .map((player, index) => {
//         return `${index + 1} ${player.name}`;
//       })
//       .join("\n");
//     bot.sendMessage(chatId, res);
//   });
// }
// };