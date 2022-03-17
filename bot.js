const TelegramBot = require("node-telegram-bot-api");
const helper = require("./helpers");
const addResult = require("./functions/addResult");
const status = require("./functions/status");
const announce = require("./functions/announce");
const register = require("./functions/register");
const startTournament = require("./functions/startTournament");
const finishGroups = require("./functions/finishGroupStage");
const finishTiebreak = require("./functions/finishTiebreak");
const prizePool = require("./functions/prizePool");
const mongoose = require("mongoose");
const { TGBotParams, token, MONGODB_URI } = require("./constants");

const bot = new TelegramBot(token, TGBotParams);

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("connected"))
  .catch((err) => console.log(`error is: ${err}`));

bot.onText(/\/announce/, (msg, [source, match]) => {
  const { id } = msg.chat;
  bot.getChatMember(id, msg.from.id).then(function (data) {
    if (data.status == "creator" || data.status == "administrator") {
      announce.announceTournament(bot, id);
    } else {
      bot.sendMessage(id, "Сорре, только админы могут юзать эту команду");
    }
  });
});

bot.onText(/\/register (.+)/, (msg, [source, value]) => {
  const { id } = msg.chat;
  const name = value.match(/[^\/]+$/)[0].trim();
  register.registerPlayer(bot, id, { name });
});

bot.onText(/\/players/, (msg, [source, match]) => {
  const { id } = msg.chat;
  helper.sendPlayers(bot, id, {});
});

bot.onText(/\/start/, (msg) => {
  const { id } = msg.chat;
  bot.getChatMember(id, msg.from.id).then(function (data) {
    if (data.status == "creator" || data.status == "administrator") {
      startTournament.startTournament(bot, id, 4);
    } else {
      bot.sendMessage(id, "Сорре, только админы могут юзать эту команду");
    }
  });
});

bot.onText(/\/addResult (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  addResult.addResult(bot, id, match.trim());
});

bot.onText(/\/status/, (msg) => {
  const { id } = msg.chat;
  status.showTournamentStatus(bot, id);
});

bot.onText(/\/finishTiebreak/, (msg) => {
  const { id } = msg.chat;
  bot.getChatMember(id, msg.from.id).then(function (data) {
    if (data.status == "creator" || data.status == "administrator") {
      finishTiebreak.finishTieBreaks(bot, id);
    } else {
      bot.sendMessage(id, "Сорре, только админы могут юзать эту команду");
    }
  });
});

bot.onText(/\/finishGroups/, (msg) => {
  const { id } = msg.chat;
  bot.getChatMember(id, msg.from.id).then(function (data) {
    if (data.status == "creator" || data.status == "administrator") {
      finishGroups.finishGroups(bot, id);
    } else {
      bot.sendMessage(id, "Сорре, только админы могут юзать эту команду");
    }
  });
});

bot.onText(/\/prizepool/, (msg) => {
  const { id } = msg.chat;
  prizePool.sendPrizePool(bot, id);
});
bot.on("polling_error", console.log);

module.exports = {
  bot,
};
