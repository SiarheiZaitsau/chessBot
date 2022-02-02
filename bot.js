const TelegramBot = require("node-telegram-bot-api");
const helper = require("./helpers");
const axios = require("axios");
const mongoose = require("mongoose");
const { LICHESS_API } = require("./constants");
const { TOURNAMENT_STATUS, Tournament } = require("./models/tournament.model");
const { Player } = require("./models/player.model");
const { Result } = require("./models/result.model");
const { Tiebreak } = require("./models/tiebreak.model");
require("./models/player.model");
require("./models/result.model");
require("./models/tournament.model");
require("./models/tiebreak.model");

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
  if (
    !tournament[0] ||
    tournament[0]?.status !== TOURNAMENT_STATUS.REGISTRATION
  ) {
    new Tournament({
      status: TOURNAMENT_STATUS.REGISTRATION,
    })
      .save()
      .then((response) => {
        bot.sendMessage(
          id,
          "Tournament is successfully started, registration is open"
        );
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
          })
          .then(
            setTimeout(() => {
              bot.sendMessage(chatId, `Список участников:`);
            }, 500)
          )
          .then(
            setTimeout(() => {
              sendPlayers(chatId);
            }, 1000)
          );
      })
      .catch(function (error) {
        bot.sendMessage(chatId, `Incorrect username`);
        console.log(error);
      });
  }
}
bot.onText(/\/register (.+)/, (msg, [source, value]) => {
  const { id } = msg.chat;
  const name = value.match(/[^\/]+$/)[0].trim();
  registerPlayer(id, { name });
});

async function sendPlayers(chatId, query) {
  Player.find(query).then((players) => {
    const res = players
      .map((player, index) => {
        return `${index + 1} ${player.name}`;
      })
      .join("\n");
    if (players.length > 0) {
      bot.sendMessage(chatId, res);
    } else {
      bot.sendMessage(chatId, "На данный момент список участников пуст");
    }
  });
}

bot.onText(/\/players/, (msg, [source, match]) => {
  const { id } = msg.chat;
  helper.sendPlayers(id, {});
});

async function addGroups() {
  // shuffle вынести в helpers
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
    Player.updateMany(
      { _id: { $in: idsA } },
      {
        $set: {
          group: "A",
        },
      }
    ),
    Player.updateMany(
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
  const [tournaments, participants] = await Promise.all([
    Tournament.find().sort({ _id: -1 }).limit(1),
    Player.find({}),
  ]);

  console.log(participants.length, "ychastniki");
  const tournament = tournaments[0];
  console.log(tournament, "tournament");
  if (!tournament || tournament?.status !== TOURNAMENT_STATUS.REGISTRATION) {
    bot.sendMessage(chatId, `tournament is already started or not announced`);
  } else if (participants.length < 4 || participants.length % 2 > 0) {
    bot.sendMessage(chatId, `Количество участников меньше 4х или нечетное`);
  } else {
    tournament.status = TOURNAMENT_STATUS.GROUPS;
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
  // const { player1, player2, score1, ...} = functionName(string)
  const splitted = string.replace(/ +(?= )/g, "").split(" ");
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
    Player.findOne({ name: player1 }),
    Player.findOne({ name: player2 }),
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
        { stage: TOURNAMENT_STATUS.GROUPS },
      ],
    });
    console.log(match, "match");
    if (player1Data.group !== player2Data.group) {
      bot.sendMessage(id, `players are in different groups`);
    } else if (match) {
      const [resultPlayer1, resultPlayer2] = await Promise.all([
        Player.findById(match.player1),
        Player.findById(match.player2),
      ]);
      bot.sendMessage(
        id,
        `Результат ${resultPlayer1.name} ${match.score1}:${match.score2} ${resultPlayer2.name} уже добавлен`
      );
    } else {
      Promise.all([
        Player.findOneAndUpdate(
          { _id: player1Data._id },
          { $inc: { score: score1 } }
        ),
        Player.findOneAndUpdate(
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
        `result ${player1} ${score1}:${score2} ${player2} is successfully added`
      );
    }
  } else if (!player1Data) {
    bot.sendMessage(id, `Неверное имя участника ${player1}`);
  } else {
    bot.sendMessage(id, `Неверное имя участника ${player2}`);
  }
}
bot.onText(/\/addResult (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  addResult(id, match.trim());
});
async function showGroupStandings(chatId, group) {
  const players = await Player.find({ group });
  bot.sendMessage(chatId, `group ${group}`);
  const sortedPlayers = players.sort((b, a) => {
    return a.score - b.score;
  });
  const res = sortedPlayers
    .map((player, index) => {
      return `${index + 1}) ${player.name} ${player.score}pts`;
    })
    .join("\n");
  setTimeout(
    () => {
      bot.sendMessage(chatId, res);
    },
    500,
    chatId,
    res
  );
}
async function checkStatus(chatId) {
  const tournament = await Tournament.find().sort({ _id: -1 }).limit(1);
  console.log(tournament);
  switch (tournament[0].status) {
    case TOURNAMENT_STATUS.REGISTRATION:
      bot.sendMessage(chatId, `Идет регистрация Список участников:`);
      setTimeout(() => {
        sendPlayers(chatId);
      }, 1000);
      break;
    case TOURNAMENT_STATUS.GROUPS:
      bot.sendMessage(chatId, `Идет Групповая стадия турнира:`);
      setTimeout(() => {
        showGroupStandings(chatId, "A");
      }, 1000);
      setTimeout(() => {
        showGroupStandings(chatId, "B");
      }, 2000);
      break;
    case TOURNAMENT_STATUS.TIEBREAK:
      const tiebreak = await Tiebreak.find({});
      const res = tiebreak
        .map((match, index) => {
          return `${index + 1}) ${match.player1} ${match.player1Score}:${
            match.player2Score
          } ${match.player2}`;
        })
        .join("\n");
      bot
        .sendMessage(chatId, "Идут Тайбрейки")
        .then(() => bot.sendMessage(chatId, res));
      break;
  }
}
bot.onText(/\/status/, (msg) => {
  const { id } = msg.chat;
  checkStatus(id);
});

async function countPersonalMatches(groupPlayers) {
  for (group of groupPlayers) {
    // console.log(group, "group");
    if (group.length > 1) {
      // Promise.all(
      await Promise.all(
        group.map(async (player, index, players) => {
          if (index < players.length - 1) {
            for (let i = 1; i < players.length - index; i++) {
              console.log(player, "current");
              console.log(players[index + i], "next");
              let match = await Result.findOne({
                $and: [
                  {
                    $or: [{ player1: player._id }, { player2: player._id }],
                  },
                  {
                    $or: [
                      { player1: players[index + i]._id },
                      { player2: players[index + i]._id },
                    ],
                  },
                ],
              });
              if (match) {
                await Promise.all([
                  Player.findOneAndUpdate(
                    { _id: match.player1 },
                    { $inc: { personalMatchesScore: match.score1 } }
                  ),
                  Player.findOneAndUpdate(
                    {
                      _id: match.player2,
                    },
                    { $inc: { personalMatchesScore: match.score2 } }
                  ),
                ]);
              }
            }
          }
        })
      );
    }
  }
  // });
}
async function showGroupStandingsByPersonalMatches(chatId, group) {
  const players = await Player.find({ group });
  const tournaments = await Tournament.find().sort({ _id: -1 }).limit(1);
  const tournament = tournaments[0];
  const sortedPlayers = players.sort((a, b) => {
    if (a.score === b.score) {
      return b.personalMatchesScore - a.personalMatchesScore;
    }
    return b.score > a.score ? 1 : -1;
  });
  const res = sortedPlayers
    .map((player, index) => {
      return `${index + 1}) ${player.name} ${player.score} pts ${
        player.personalMatchesScore
      } personal matches score`;
    })
    .join("\n");
  bot.sendMessage(chatId, res);
  const groupByPersonalMatches =
    helper.sameScoreAndPersonalMatchesGroupPlayers(sortedPlayers);
  console.log(groupByPersonalMatches, "tiegroups");
  let tieBreakPairs = [];
  const dbPairs = [];
  groupByPersonalMatches.forEach((players) => {
    if (players.length > 1) {
      const res = players.flatMap((player, i) => {
        return players.slice(i + 1).map((w) => {
          dbPairs.push({
            player1: player.name,
            player1Id: player._id,
            player2: w.name,
            player2Id: w.id,
          });
          return { player1: player.name, player2: w.name };
        });
      });
      tieBreakPairs.push(res);
    }
  });
  await Promise.all(
    dbPairs.map(async (pair) => {
      new Tiebreak({
        player1: pair.player1,
        player1Id: pair.player1Id,
        player2: pair.player2,
        player2Id: pair.player2Id,
      }).save();
    })
  );
  if (tieBreakPairs.length > 0) {
    tournament.status = TOURNAMENT_STATUS.TIEBREAK;
    await tournament.save();
    bot.sendMessage(chatId, "Пары переигровок").then(() => {
      const res = tieBreakPairs
        .map((players, index) => {
          return players.map((player) => {
            return `${player.player1} vs ${player.player2}`;
          });
        })
        .join("\n");
      bot.sendMessage(chatId, res);
    });
  } else {
    tournament.status = TOURNAMENT_STATUS.PLAYOFF;
    await tournament.save();
    bot.sendMessage(chatId, "Групповая стадия успешно завершена");
  }
}
async function finishGroups(chatId) {
  const tournaments = await Tournament.find().sort({ _id: -1 }).limit(1);
  const tournament = tournaments[0];
  if (!tournament || tournament?.status !== TOURNAMENT_STATUS.GROUPS) {
    bot.sendMessage(chatId, "Групповая стадия не активна");
  } else {
    const [playersA, playersB] = await Promise.all([
      Player.find({ group: "A" }),
      Player.find({ group: "B" }),
    ]);
    await countPersonalMatches(helper.sameScoreGroupPlayers(playersA));
    showGroupStandingsByPersonalMatches(chatId, "A");
    await countPersonalMatches(helper.sameScoreGroupPlayers(playersB));
    showGroupStandingsByPersonalMatches(chatId, "B");
  }
}
bot.onText(/\/finishGroups/, (msg) => {
  const { id } = msg.chat;
  finishGroups(id);
});

async function addTiebreakResult(id, string) {
  const tournaments = await Tournament.find().sort({ _id: -1 }).limit(1);
  const tournament = tournaments[0];
  const splitted = string.replace(/ +(?= )/g, "").split(" ");
  const player1 = splitted[0].toLowerCase();
  const splittedScore = splitted[1].split(":");
  const score1 = parseFloat(splittedScore[0].replace(",", "."));
  const score2 = parseFloat(splittedScore[1].replace(",", "."));
  const link = splitted[3] || undefined;
  const player2 = splitted[2].toLowerCase();
  if (tournament.status !== TOURNAMENT_STATUS.TIEBREAK) {
    bot.sendMessage(id, "Команда не доступна для этой стадии турнира");
    throw new Error("Incorrect score");
  }
  if ((score1 + score2) % 1 > 0) {
    bot.sendMessage(id, "incorrect score entry");
    throw new Error("Incorrect score");
  }
  const [player1Data, player2Data, tiebreakMatch] = await Promise.all([
    Player.findOne({ name: player1 }),
    Player.findOne({ name: player2 }),
    Tiebreak.findOne({
      $and: [
        {
          $or: [{ player1: player1 }, { player2: player2 }],
        },
        {
          $or: [{ player1: player1 }, { player2: player2 }],
        },
      ],
    }),
  ]);
  if (player1Data && player2Data && tiebreakMatch) {
    const match = await Result.findOne({
      $and: [
        {
          $or: [{ player1: player1Data._id }, { player2: player1Data._id }],
        },
        {
          $or: [{ player1: player2Data._id }, { player2: player2Data._id }],
        },
        { stage: TOURNAMENT_STATUS.TIEBREAK },
      ],
    });
    if (match) {
      bot.sendMessage(
        id,
        `Результат ${player1} ${match.score1}:${match.score2} ${player2} уже добавлен`
      );
    } else {
      Promise.all([
        Player.findOneAndUpdate(
          { _id: player1Data._id },
          { $inc: { tiebreakScore: score1 } }
        ),
        Player.findOneAndUpdate(
          { _id: player2Data._id },
          { $inc: { tiebreakScore: score2 } }
        ),
        new Result({
          player1: player1Data._id,
          score1,
          player2: player2Data._id,
          score2,
          stage: TOURNAMENT_STATUS.TIEBREAK,
        }).save(),
      ]);
      bot.sendMessage(
        id,
        `result ${player1} vs ${player2} is successfully added`
      );
      if (tiebreakMatch.player1 === player1) {
        tiebreakMatch.player1Score = score1;
        tiebreakMatch.player2Score = score2;
        await tiebreakMatch.save();
      } else {
        tiebreakMatch.player1Score = score2;
        tiebreakMatch.player2Score = score1;
        await tiebreakMatch.save();
      }
    }
  } else if (!player1Data) {
    bot.sendMessage(id, `Неверное имя участника ${player1}`);
  } else if (!player2Data) {
    bot.sendMessage(id, `Неверное имя участника ${player2}`);
  } else {
    bot.sendMessage(id, `Пара ${player1} ${player2} не существует`);
  }
}
async function finishTieBreaks(chatId, group) {
  const tournaments = await Tournament.find().sort({ _id: -1 }).limit(1);
  const tournament = tournaments[0];
  if (!tournament || tournament?.status !== TOURNAMENT_STATUS.TIEBREAK) {
    bot.sendMessage(chatId, "Тайбрейк стадия не активна");
  } else {
    await showFinalStandings(chatId, "A");
    await showFinalStandings(chatId, "B");

    tournament.status = TOURNAMENT_STATUS.PLAYOFF;
    await tournament.save();

    bot.sendMessage(chatId, "Групповая стадия успешно завершена ГЛ В ПЛЕЙОФЕ");
  }
}
async function showFinalStandings(chatId, group) {
  const players = await Player.find({ group });

  const randomNumbers = helper.generateRandomNumbers();
  const randomResults = [];
  let i = 0;
  const sortedPlayers = players.sort((a, b) => {
    if (a.score === b.score) {
      if (a.personalMatchesScore === b.personalMatchesScore) {
        if (a.tiebreakScore === b.tiebreakScore) {
          if (!a.randomNumber) {
            a.randomNumber = randomNumbers[i];

            randomResults.push({name: a.name, value: a.randomNumber });
            i++;
          }
          if (!b.randomNumber) {
            b.randomNumber = randomNumbers[i];
            randomResults.push({name: b.name, value: b.randomNumber });
            i++;
          }
          return a.randomNumber > b.randomNumber ? -1 : 1;
        }
        return a.tiebreakScore > b.tiebreakScore ? -1 : 1;
      } else {
        return a.personalMatchesScore < b.personalMatchesScore ? 1 : -1;
      }
    } else {
      return a.score < b.score ? 1 : -1;
    }
  });

  const firstMessage = randomResult.map(player => (
    `Random number for ${player.name} is ${random.number}`
  )).join("\n");

  const secondMessage = sortedPlayers
    .map((player, index) => (
      `${index + 1}) ${player.name} ${player.score} pts | ${
        player.personalMatchesScore
      } personal matches score | ${player.tiebreakScore} tiebreak score |  ${
        player.randomNumber ? `${player.randomNumber} random score` : ""
      }`
    ))
    .join("\n");

  bot.sendMessage(chatId, firstMessage).then(() => 
      bot.sendMessage(chatId, secondMessage)
  );
}

bot.onText(/\/finishTiebreak/, (msg) => {
  const { id } = msg.chat;
  finishTieBreaks(id, "A");
});

bot.onText(/\/addTiebreakResult (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  addTiebreakResult(id, match);
});

bot.on("polling_error", console.log);

module.exports = {
  bot,
};
