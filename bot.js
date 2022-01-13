const TelegramBot = require("node-telegram-bot-api");
const helper = require("./helpers");
const token = "5075310188:AAFJJAPibPicZEzZl9M--T7ULy8kfQ6tI8A";
const axios = require("axios");
const mongoose = require("mongoose");
const constants = require("./constants")
const playersHelpers = require('./helpers/players');
const MONGODB_URI =
  "mongodb+srv://oslan228:papech364@telegram.nnwcf.mongodb.net/telegram?retryWrites=true&w=majority";
require("./models/player.model");
require("./models/result.model");
require("./models/status.model");
const bot = new TelegramBot(token, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10,
    },
  },
});
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("connected"))
  .catch((err) => console.log(`error is: ${err}`));
helper.logStart();

const Player = mongoose.model("players");
const Status = mongoose.model("status");
const Result = mongoose.model("results");

const LICHESS_API = constants.LICHESS_API;
// ================

async function registerPlayer(chatId, query) {
  axios
    .get(`${LICHESS_API}/${query.name}`)
    .then(function (response) {
      new Player({
        name: query.name.toLowerCase(),
      })
        .save()
        .then((response) =>
          bot.sendMessage(chatId, `user ${query.name} is succesfully registred`)
        )
        .catch((e) => {
          console.log(e);
          bot.sendMessage(chatId, `User is already exist`);
        });
    })
    .catch(function (error) {
      bot.sendMessage(chatId, `Incorrect username`);
      console.log(error);
    });
}
bot.onText(/\/register (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  const name = match.match(/[^\/]+$/)[0];
  registerPlayer(id, { name });
});

async function sendPlayers(chatId, query) {
  Player.find(query).then((players) => {
    const res = players
      .map((player, index) => {
        return `${index + 1} ${player.name}`;
      })
      .join("\n");
    bot.sendMessage(chatId, res)
  });
}

bot.onText(/\/players/, (msg, [source, match]) => {
  const { id } = msg.chat;
  sendPlayers(id, {});
});

//   console.log("Working", msg.from.first_name);
//   const chatId = helper.getChatId(msg);
//   switch (msg.text) {
//     case kb.home.favoritte:
//       break;
//     case kb.home.films:
//       bot.sendMessage(chatId, `Выберите жанр:`, {
//         reply_markup: {
//           keyboard: keyboard.films,
//         },
//       });
//       break;
//     case kb.home.cimenas:
//       break;
//     case kb.back:
//       bot.sendMessage(chatId, `Что хотите посмотреть?:`, {
//         reply_markup: {
//           keyboard: keyboard.home,
//         },
//       });
//       break;
//   }
// });
function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

function addOpponents(players, groupIds) {
  console.log(players, 'players');
  console.log(groupIds, 'groupIds')
  const opponents = players.reduce((accum, item) => {  
   if(groupIds.includes(item._id)) {
     accum.push(item.name)
   }
    return accum
  }, [])
  console.log(opponents, 'opponents');
  return opponents
}
async function addGroups() {
  const array = await Player.find({});
  const shuffeled = shuffle(array);
  const idsA = [];
  const idsB = [];
  shuffeled.forEach((item, index) => {
    if (index % 2 === 0) {
      idsA.push(item._id);
    } else {
      idsB.push(item._id);
    }
  });
  console.log(idsA, "a");
  console.log(idsB, "b");

  await Player.updateMany({ _id: { $in: idsA } }, 
  { 
    $set: { 
    group: "A",
    opponents: addOpponents(shuffeled, idsA) 
    },
  } 
  );
  await Player.updateMany(
    { 
    _id: { $in: idsB } },
    { 
    $set: {
    group: "B", 
    opponents: addOpponents(shuffeled, idsB) 
    } 
    }
    );
}

function sendGroup(chatId, group) {
  bot.sendMessage(chatId, `Group ${group}`)
   sendPlayers(chatId, { group })
}

async function startTournament(chatId) {
  const status = await Status.findOne();
  if (status.started === true) {
    bot.sendMessage(chatId, `tournament is already started`);
  } else {
    status.started = true;
    await status
      .save()
      .then(await addGroups())
      .then (
        bot.sendMessage(chatId, `tournament has been succesfully started`)
        )
      .then(setTimeout(() => {
        sendGroup(chatId, 'A')
      }, 1000) )
      .then(setTimeout(() => {
        sendGroup(chatId, 'B')
      }, 2000) )
      // .then( sendPlayers(chatId, { group: "A" }))
      // .then(bot.sendMessage(chatId, "Group B"))
      // .then(sendPlayers(chatId, { group: "B" }))
  }
}
bot.onText(/\/start/, (msg) => {
  const { id } = msg.chat;
  startTournament(id);
});

async function addResult(id, string) {
  const splitted = string.split(" ");
  const player1 = splitted[0];
  const splittedScore = splitted[1].split(":");
  console.log(splittedScore, "splittedScore");
  const score1 = parseFloat(splittedScore[0].replace(",", "."));
  const score2 = parseFloat(splittedScore[1].replace(",", "."));
  const player2 = splitted[2];
  console.log(player1, "player1");
  console.log(score1, "score1");
  console.log(player2, "player2");
  console.log(score2, "score2");
  console.log(score1 + score2, "sum");
  if ((score1 + score2) % 1 > 0) {
    bot.sendMessage(id, "incorrect score entry");
    throw new Error("Incorrect score");
  }
  await Player.updateOne({ name: player1 }, { $inc: { score: score1 } });
  await Player.updateOne({ name: player2 }, { $inc: { score: score2 } });
  new Result({
    player1,
    score1,
    player2,
    score2,
  });
  bot.sendMessage(id, `result ${string} is sucesfully added`);
}
bot.onText(/\/addResult (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  addResult(id, match);
});

bot.on("polling_error", console.log);

module.exports = {
  bot
}