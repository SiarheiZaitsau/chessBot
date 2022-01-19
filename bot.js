const TelegramBot = require("node-telegram-bot-api");
const helper = require("./helpers");
const axios = require("axios");
const mongoose = require("mongoose");
const { LICHESS_API } = require("./constants");
const { TOURNAMENT_STATUS, Tournament } = require("./models/tournament.model");
const { Player } = require("./models/player.model");
const { Result } = require("./models/result.model");
require("./models/player.model");
require("./models/result.model");
require("./models/tournament.model");

const token = "5075310188:AAFJJAPibPicZEzZl9M--T7ULy8kfQ6tI8A";
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

async function announceTournament(id) {
  const tournament = await Tournament.find().sort({ _id: -1 }).limit(1);
  console.log(tournament);
  if (tournament[0].status !== TOURNAMENT_STATUS.REGISTRATION) {
    new Tournament({
      status: TOURNAMENT_STATUS.REGISTRATION,
    })
      .save()
      .then((response) => {
        bot.sendMessage(id, " Tournament is successfully Registration is open");
      });
  } else {
    bot.sendMessage(id, "Tournament is already active");
  }
}
bot.onText(/\/announce/, (msg, [source, match]) => {
  const { id } = msg.chat;
  announceTournament(id);
});

async function registerPlayer(chatId, query) {
  const tournament = await Tournament.find().sort({ _id: -1 }).limit(1);
  console.log(tournament, "tournament");
  if (tournament[0].status !== TOURNAMENT_STATUS.REGISTRATION) {
    bot.sendMessage(chatId, `Sorry registration is closed`);
  } else {
    axios
      .get(`${LICHESS_API}/${query.name}`)
      .then(function (response) {
        new Player({
          name: query.name.toLowerCase(),
        })
          .save()
          .then((response) =>
            bot.sendMessage(
              chatId,
              `user ${query.name} is successfully registered`
            )
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
    bot.sendMessage(chatId, res);
  });
}

bot.onText(/\/players/, (msg, [source, match]) => {
  const { id } = msg.chat;
  helper.sendPlayers(id, {});
});

async function addGroups() {
  const players = await Player.find({});
  const shuffledPlayers = helper.shuffle(players);
  const idsA = [];
  const idsB = [];
  shuffledPlayers.forEach((item, index) => {
    if (index % 2 === 0) {
      idsA.push(item._id);
    } else {
      idsB.push(item._id);
    }
  });
  console.log(idsA, "a");
  console.log(idsB, "b");
  Promise.all([
    await Player.updateMany(
      { _id: { $in: idsA } },
      {
        $set: {
          group: "A",
        },
      }
    ),
    await Player.updateMany(
      {
        _id: { $in: idsB },
      },
      {
        $set: {
          group: "B",
        },
      }
    ),
  ]);
}

function sendGroup(chatId, group) {
  bot.sendMessage(chatId, `Group ${group}`);
  sendPlayers(chatId, { group });
}

async function startTournament(chatId) {
  const tournament = await Tournament.find().sort({ _id: -1 }).limit(1);
  if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
    bot.sendMessage(chatId, `tournament is already started`);
  } else {
    tournament.TOURNAMENT_STATUS = TOURNAMENT_STATUS.GROUPS;
    await tournament
      .save()
      .then(await addGroups())
      .then(bot.sendMessage(chatId, `tournament has been successfully started`))
      .then(
        setTimeout(() => {
          sendGroup(chatId, "A");
        }, 1000)
      )
      .then(
        setTimeout(() => {
          sendGroup(chatId, "B");
        }, 2000)
      );
  }
}
bot.onText(/\/start/, (msg) => {
  const { id } = msg.chat;
  startTournament(id);
});

async function addResult(id, string) {
  const splitted = string.split(" ");
  const player1 = splitted[0].toLowerCase();
  const splittedScore = splitted[1].split(":");
  const score1 = parseFloat(splittedScore[0].replace(",", "."));
  const score2 = parseFloat(splittedScore[1].replace(",", "."));
  const link = splitted[3] || undefined;
  const player2 = splitted[2].toLowerCase();
  if ((score1 + score2) % 1 > 0) {
    bot.sendMessage(id, "incorrect score entry");
    throw new Error("Incorrect score");
  }
  const [player1Data, player2Data] = await Promise.all([
    await Player.findOne({ name: player1 }),
    await Player.findOne({ name: player2 }),
  ]);

  if (player1Data && player2Data) {
    const match = await Result.findOne({
      $and: [
        {
          $or: [{ player1: player1Data._id }, { player2: player1Data._id }],
        },
        {
          $or: [{ player1: player2Data._id }, { player2: player2Data._id }],
        },
      ],
    });
    if (player1Data.group !== player2Data.group) {
      bot.sendMessage(id, `players are in different groups`);
    } else if (match) {
      bot.sendMessage(id, `match ${player1} ${player2} is already added`);
    } else {
      Promise.all([
        await Player.findOneAndUpdate(
          { _id: player1Data._id },
          { $inc: { score: score1 } }
        ),
        await Player.findOneAndUpdate(
          { _id: player2Data._id },
          { $inc: { score: score2 } }
        ),
        new Result({
          player1: player1Data._id,
          score1,
          player2: player2Data._id,
          score2,
          link,
        }).save(),
      ]);
      bot.sendMessage(
        id,
        `result ${player1} vs ${player2} is successfully added`
      );
    }
  } else {
    bot.sendMessage(id, `Incorrect Player name`);
  }
}
bot.onText(/\/addResult (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  addResult(id, match);
});

bot.on("polling_error", console.log);

module.exports = {
  bot,
};
