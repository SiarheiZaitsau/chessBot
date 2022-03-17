const TelegramBot = require("node-telegram-bot-api");
const helper = require("./helpers");
const token = "5075310188:AAFJJAPibPicZEzZl9M--T7ULy8kfQ6tI8A";
const axios = require("axios");
const mongoose = require("mongoose");
const MONGODB_URI =
  "mongodb+srv://oslan228:papech364@telegram.nnwcf.mongodb.net/telegram?retryWrites=true&w=majority";
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

require("./models/player.model");
const Player = mongoose.model("players");
const Status = mongoose.model("status");

// ================

async function checkUniquePlayer(chatId, query) {
  Player.find(query).then((player) => {
    console.log(player);
    if (player.length > 0) {
      bot.sendMessage(chatId, `user ${query.name} is already registred`);
    } else {
      axios
        .get(`https://lichess.org/api/user/${query.name}`)
        .then(function (response) {
          new Player({
            name: query.name,
            group: "",
            score: 0,
          })
            .save()
            .catch((e) => {
              console.log(e);
              bot.sendMessage(chatId, `Error`);
            });
          bot.sendMessage(
            chatId,
            `Player ${query.name} is Succesfully regisred`
          );
          console.log(response);
        })
        .catch(function (error) {
          bot.sendMessage(chatId, `Incorrect username`);
          console.log(error);
        });
    }
  });
}
bot.onText(/\/register (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  const name = match.match(/[^\/]+$/)[0];
  checkUniquePlayer(id, { name });
});
function sendPlayers(chatId, query) {
  Player.find(query).then((players) => {
    const res = players
      .map((player, index) => {
        return `${index + 1} ${player.name}`;
      })
      .join("\n");
    bot.sendMessage(chatId, res);
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

  await Player.updateMany({ _id: { $in: idsA } }, { $set: { group: "A" } });
  await Player.updateMany({ _id: { $in: idsB } }, { $set: { group: "B" } });
}
async function startTournament(chatId) {
  const status = await Status.findOne();
  if (status.started === true) {
    bot.sendMessage(chatId, `tournament is already started`);
  } else {
    status.started = true;
    await status
      .save()
      .then(addGroups())
      .then(bot.sendMessage(chatId, `tournament has been succesfully started`))
      .then(bot.sendMessage(chatId, "Group A"))
      .then(await sendPlayers(chatId, { group: "A" }))
      .then(bot.sendMessage(chatId, "Group B"))
      .then(await sendPlayers(chatId, { group: "B" }));
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
  await Player.findOneAndUpdate(
    { name: player1 },
    { $inc: { score: score1 } },
    (err, doc) => {
      if (err) console.log("Something wrong when updating data!");
      console.log(doc);
  }
  );
  await Player.findOneAndUpdate(
    { name: player2 }, //
    { $inc: { score: score2 } },
    (err, doc) => {
    if (err) console.log("Something wrong when updating data!");
    console.log(doc);
}
  );
  bot.sendMessage(id, `result ${string} is sucesfully added`);
}
bot.onText(/\/addResult (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  addResult(id, match);
});

bot.on("polling_error", console.log);
