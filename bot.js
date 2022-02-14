const TelegramBot = require("node-telegram-bot-api");
const helper = require("./helpers");
const axios = require("axios");
const mongoose = require("mongoose");
const { LICHESS_API } = require("./constants");
const {
  TOURNAMENT_STATUS,
  Tournament,
  GROUP_NAMES,
} = require("./models/tournament.model");
const { Player } = require("./models/player.model");
const { Result } = require("./models/result.model");
const { Tiebreak } = require("./models/tiebreak.model");
const { Playoff, PLAYOFF_STATUS } = require("./models/playoff.model");
require("./models/player.model");
require("./models/result.model");
require("./models/tournament.model");
require("./models/tiebreak.model");
require("./models/playoff.model");

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
          .then(() => bot.sendMessage(chatId, `Список участников:`))
          .then(() => sendPlayers(chatId));
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
  const players = await Player.find(query);
  const res = players
    .map((player, index) => {
      return `${index + 1} ${player.name}`;
    })
    .join("\n");
  if (players.length > 0) {
    await bot.sendMessage(chatId, res);
  } else {
    bot.sendMessage(chatId, "На данный момент список участников пуст");
  }
}

bot.onText(/\/players/, (msg, [source, match]) => {
  const { id } = msg.chat;
  helper.sendPlayers(id, {});
});

async function addGroups(numberOfGroups) {
  const players = await Player.find({});
  const shuffledPlayers = helper.shuffle(players);
  const numberOfPlayers = shuffledPlayers.length;
  const numberOfPlayersInGroup = numberOfPlayers / numberOfGroups;
  // const idsA = [];
  // const idsB = [];
  const playersInGroup = helper.splitArrayIntoChunksOfLen(
    shuffledPlayers,
    numberOfPlayersInGroup
  );
  const groupsIds = playersInGroup.map((players, index) => {
    const ids = players.map((player) => {
      return player._id;
    });
    return ids;
  });
  await Promise.all(
    groupsIds.map(async (ids, index) => {
      console.log(ids, "ids");
      await Player.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            group: `${GROUP_NAMES[index]}`,
          },
        }
      );
    })
  );
}

async function sendGroup(chatId, group) {
  await bot.sendMessage(chatId, `Group ${group}`);
  await sendPlayers(chatId, { group });
}

async function startTournament(chatId, numberOfGroups) {
  const [tournaments, participants] = await Promise.all([
    Tournament.find().sort({ _id: -1 }).limit(1),
    Player.find({}),
  ]);

  const tournament = tournaments[0];
  console.log(tournament, "tournament");
  if (!tournament || tournament?.status !== TOURNAMENT_STATUS.REGISTRATION) {
    bot.sendMessage(chatId, `tournament is already started or not announced`);
  } else if (participants.length < 4 || participants.length % 2 > 0) {
    bot.sendMessage(chatId, `Количество участников меньше 4х или нечетное`);
  } else {
    tournament.status = TOURNAMENT_STATUS.GROUPS;
    tournament.groupsNumber = numberOfGroups;
    await tournament.save().then(await addGroups(numberOfGroups));
    await sendGroup(chatId, "A");
    await sendGroup(chatId, "B");
    await sendGroup(chatId, "C");
    await sendGroup(chatId, "D");
    bot.sendMessage(chatId, `tournament has been successfully started`);
  }
}
bot.onText(/\/start/, (msg) => {
  const { id } = msg.chat;
  startTournament(id, 4);
});

async function addResult(id, string) {
  const tournament = await Tournament.find().sort({ _id: -1 }).limit(1);
  const stage = tournament[0].status;
  // const { player1, player2, score1, ...} = functionName(string)
  const splitted = string.replace(/ +(?= )/g, "").split(" ");
  const player1 = splitted[0].toLowerCase();
  const splittedScore = splitted[1].split(":");
  const score1 = parseFloat(splittedScore[0].replace(",", "."));
  const score2 = parseFloat(splittedScore[1].replace(",", "."));
  const link = splitted[3] || undefined;
  const player2 = splitted[2].toLowerCase();
  if (stage === TOURNAMENT_STATUS.GROUPS) {
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
          { stage: stage },
        ],
      });
      if (
        player1Data.group !== player2Data.group &&
        stage === TOURNAMENT_STATUS.GROUPS
      ) {
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
  } else if (stage === TOURNAMENT_STATUS.PLAYOFF) {
    addPlayoffResult(player1, player2, score1, score2, link, id);
  }
}
async function addPlayoffResult(player1, player2, score1, score2, link, id) {
  const lastMatch = await Playoff.find({
    $and: [
      {
        $or: [{ player1: player1 }, { player2: player1 }],
      },
      {
        $or: [{ player1: player2 }, { player2: player2 }],
      },
    ],
  })
    .sort({ _id: -1 })
    .limit(1);
  const match = lastMatch[0];
  console.log(match, "match");
  const [player1Data, player2Data] = await Promise.all([
    Player.findOne({ name: player1 }),
    Player.findOne({ name: player2 }),
  ]);
  if (!match) {
    bot.sendMessage(id, `incorrect userName or match doesn't exist`);
  } else if (match && (match.score1 || match.score2)) {
    bot.sendMessage(
      id,
      `result ${match.player1} ${match.score1}:${match.score2} ${match.player2} is already added `
    );
  } else if (score1 === score2) {
    bot.sendMessage(id, `Некорректный счет матча `);
  } else {
    let winner = player2;
    let looser = player1;
    if (score1 > score2) {
      winner = player1;
      looser = player2;
    }
    switch (match.stage) {
      case ROUND1_WINNERS_MATCH1:
      case ROUND1_WINNERS_MATCH2:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [{ player1: player1 }, { player2: player2 }],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [{ player1: player2 }, { player2: player1 }],
              },
              { score1: score2, score2: score1 }
            );
          }
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: ROUND2_WINNERS_MATCH1 }),
            Playoff.findOne({ stage: "1/8-L1" }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND2_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.updateOne({ stage: "1/8-L1" }, { player2: looser }),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.create({ stage: ROUND2_WINNERS_MATCH1, player1: winner }),
              Playoff.updateOne({ stage: "1/8-L1" }, { player2: looser }),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND2_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.create({ stage: "1/8-L1", player1: looser }),
            ]);
          } else {
            Promise.all([
              Playoff.create({ stage: ROUND2_WINNERS_MATCH1, player1: winner }),
              Playoff.create({ stage: "1/8-L1", player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND1_WINNERS_MATCH3:
      case ROUND1_WINNERS_MATCH4:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [{ player1: player1 }, { player2: player2 }],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [{ player1: player2 }, { player2: player1 }],
              },
              { score1: score2, score2: score1 }
            );
          }
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: ROUND2_WINNERS_MATCH2 }),
            Playoff.findOne({ stage: ROUND1_LOSERS_MATCH2 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            Promise.all([
              Playoff.updateOne(
                { stage: ROUND2_WINNERS_MATCH2 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: ROUND1_LOSERS_MATCH2 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            Promise.all([
              Playoff.create({ stage: ROUND2_WINNERS_MATCH2, player1: winner }),
              Playoff.updateOne(
                { stage: ROUND1_LOSERS_MATCH2 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            Promise.all([
              Playoff.updateOne(
                { stage: ROUND2_WINNERS_MATCH2 },
                { player2: winner }
              ),
              Playoff.create({ stage: ROUND1_LOSERS_MATCH2, player1: looser }),
            ]);
          } else {
            Promise.all([
              Playoff.create({ stage: ROUND2_WINNERS_MATCH2, player1: winner }),
              Playoff.create({ stage: ROUND1_LOSERS_MATCH2, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND1_LOSERS_MATCH1:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }
          const newMatchWinner = await Playoff.findOne({
            stage: ROUND2_LOSERS_MATCH1,
          });
          if (newMatchWinner) {
            await Playoff.updateOne(
              { stage: ROUND2_LOSERS_MATCH1 },
              { player2: winner }
            );
          } else {
            await Playoff.create({
              stage: ROUND2_LOSERS_MATCH1,
              player1: winner,
            });
          }
          await Player.findOneAndUpdate(
            { name: looser },
            { $set: { finalPlace: "7-8" } }
          );
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND1_LOSERS_MATCH2:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }
          const newMatchWinner = await Playoff.findOne({
            stage: ROUND2_LOSERS_MATCH2,
          });
          if (newMatchWinner) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND2_LOSERS_MATCH2 },
                { player2: winner }
              ),
            ]);
          } else {
            await Promise.all([
              Playoff.create({ stage: ROUND2_LOSERS_MATCH2, player1: winner }),
            ]);
          }
          await Player.findOneAndUpdate(
            { name: looser },
            { $set: { finalPlace: "7-8" } }
          );
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND2_WINNERS_MATCH1:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: ROUND3_WINNERS_MATCH1 }),
            Playoff.findOne({ stage: ROUND2_LOSERS_MATCH1 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND3_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: ROUND2_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.create({ stage: ROUND3_WINNERS_MATCH1, player1: winner }),
              Playoff.updateOne(
                { stage: ROUND2_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND3_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.create({ stage: ROUND2_LOSERS_MATCH1, player1: looser }),
            ]);
          } else {
            await Promise.all([
              Playoff.create({ stage: ROUND3_WINNERS_MATCH1, player1: winner }),
              Playoff.create({ stage: ROUND2_LOSERS_MATCH1, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND2_WINNERS_MATCH2:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: ROUND3_WINNERS_MATCH1 }),
            Playoff.findOne({ stage: ROUND2_LOSERS_MATCH2 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND3_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: ROUND2_LOSERS_MATCH2 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.create({ stage: ROUND3_WINNERS_MATCH1, player1: winner }),
              Playoff.updateOne(
                { stage: ROUND2_LOSERS_MATCH2 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND3_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.create({ stage: ROUND2_LOSERS_MATCH2, player1: looser }),
            ]);
          } else {
            await Promise.all([
              Playoff.create({ stage: ROUND3_WINNERS_MATCH1, player1: winner }),
              Playoff.create({ stage: ROUND2_LOSERS_MATCH2, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND2_LOSERS_MATCH1:
      case ROUND2_LOSERS_MATCH2:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }
          const newMatchWinner = await Playoff.findOne({
            stage: ROUND3_LOSERS_MATCH1,
          });
          if (newMatchWinner) {
            await Playoff.updateOne(
              { stage: ROUND3_LOSERS_MATCH1 },
              { player2: winner }
            );
          } else {
            await Playoff.create({
              stage: ROUND3_LOSERS_MATCH1,
              player1: winner,
            });
          }
          await Player.findOneAndUpdate(
            { name: looser },
            { $set: { finalPlace: "5-6" } }
          );
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND3_LOSERS_MATCH1:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }
          const newMatchWinner = await Playoff.findOne({
            stage: ROUND4_LOSERS_MATCH1,
          });
          if (newMatchWinner) {
            await Playoff.updateOne(
              { stage: ROUND4_LOSERS_MATCH1 },
              { player2: winner }
            );
          } else {
            await Playoff.create({
              stage: ROUND4_LOSERS_MATCH1,
              player1: winner,
            });
          }
          await Player.findOneAndUpdate(
            { name: looser },
            { $set: { finalPlace: "4" } }
          );
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND3_WINNERS_MATCH1:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: ROUND4_WINNERS_MATCH1 }),
            Playoff.findOne({ stage: ROUND4_LOSERS_MATCH1 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND4_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: ROUND4_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.create({ stage: ROUND4_WINNERS_MATCH1, player1: winner }),
              Playoff.updateOne(
                { stage: ROUND4_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: ROUND4_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.create({ stage: ROUND4_LOSERS_MATCH1, player1: looser }),
            ]);
          } else {
            await Promise.all([
              Playoff.create({ stage: ROUND4_WINNERS_MATCH1, player1: winner }),
              Playoff.create({ stage: ROUND4_LOSERS_MATCH1, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND4_LOSERS_MATCH1:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }
          const newMatchWinner = await Playoff.findOne({
            stage: ROUND4_WINNERS_MATCH1,
          });
          if (newMatchWinner) {
            await Playoff.updateOne(
              { stage: ROUND4_WINNERS_MATCH1 },
              { player2: winner }
            );
          } else {
            await Playoff.create({
              stage: ROUND4_WINNERS_MATCH1,
              player1: winner,
            });
          }
          await Player.findOneAndUpdate(
            { name: looser },
            { $set: { finalPlace: "3" } }
          );
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case ROUND4_WINNERS_MATCH1:
        {
          new Result({
            player1: player1Data._id,
            score1,
            player2: player2Data._id,
            score2,
            stage: match.stage,
            link,
          }).save();
          if (player1 === match.player1) {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player1 },
                  { player2: player2 },
                  { stage: match.stage },
                ],
              },
              { score1, score2 }
            );
          } else {
            await Playoff.updateOne(
              {
                $and: [
                  { player1: player2 },
                  { player2: player1 },
                  { stage: match.stage },
                ],
              },
              { score1: score2, score2: score1 }
            );
          }

          await Player.findOneAndUpdate(
            { name: looser },
            { $set: { finalPlace: "2" } }
          );
          await Player.findOneAndUpdate(
            { name: winner },
            { $set: { finalPlace: "1" } }
          );
          await Playoff.updateOne(
            {
              $and: [
                { player1: player2 },
                { player2: player1 },
                { stage: match.stage },
              ],
            },
            { score1: score2, score2: score1 }
          );
          const tournaments = await Tournament.find()
            .sort({ _id: -1 })
            .limit(1);
          const tournament = tournaments[0];
          tournament.status = TOURNAMENT_STATUS.COMPLETED;
          await tournament.save();
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added Tournament is finished  Поздравляем ${winner}`
          );
        }
        break;
    }
  }
}
bot.onText(/\/addResult (.+)/, (msg, [source, match]) => {
  const { id } = msg.chat;
  addResult(id, match.trim());
});
async function showGroupStandings(chatId, group) {
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
}
async function checkStatus(chatId) {
  const tournament = await Tournament.find().sort({ _id: -1 }).limit(1);
  switch (tournament[0].status) {
    case TOURNAMENT_STATUS.REGISTRATION:
      await bot.sendMessage(chatId, `Идет регистрация Список участников:`);
      sendPlayers(chatId);
      break;
    case TOURNAMENT_STATUS.GROUPS:
      {
        const numberOfGroups = tournament[0].groupsNumber;
        const groups = GROUP_NAMES.slice(0, numberOfGroups);
        bot.sendMessage(chatId, `Идет Групповая стадия турнира:`);
        for (const group of groups) {
          await showGroupStandings(chatId, group);
        }
      }
      break;
    case TOURNAMENT_STATUS.TIEBREAK:
      {
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
      }
      break;
    case TOURNAMENT_STATUS.PLAYOFF:
      const playoff = await Playoff.find({});
      const res = playoff
        .map((match, index) => {
          return `stage: ${match.stage} ${
            match.player1 || "Соперник не определен"
          } ${match.score1 || 0}:${match.score || 0} ${
            match.player2 || "Соперник не определен"
          }`;
        })
        .join("\n");
      bot
        .sendMessage(chatId, "Матчи Плей-офф")
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
  await bot.sendMessage(chatId, res);
  const groupByPersonalMatches =
    helper.sameScoreAndPersonalMatchesGroupPlayers(sortedPlayers);
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
    bot.sendMessage(chatId, "Групповая стадия успешно завершена ГЛ в плейофе");
    await Promise.all(
      sortedPlayers.map(async (player, index) => {
        await Player.findOneAndUpdate(
          { _id: player._id },
          { $set: { groupPlace: index + 1 } }
        );
      })
    );
  }
}
async function finishGroups(chatId) {
  const tournaments = await Tournament.find().sort({ _id: -1 }).limit(1);
  const tournament = tournaments[0];
  const groupsNumber = tournament.groupsNumber;
  const groups = GROUP_NAMES.slice(0, groupsNumber);
  console.log(groups, "groups");
  if (!tournament || tournament?.status !== TOURNAMENT_STATUS.GROUPS) {
    bot.sendMessage(chatId, "Групповая стадия не активна");
  } else {
    // const [playersA, playersB, playersC, playersD] = await Promise.all([
    //   Player.find({ group: "A" }),
    //   Player.find({ group: "B" }),
    //   Player.find({ group: "C" }),
    //   Player.find({ group: "D" }),
    // ]);
    // const playersPromises = groups.map(
    //   async (group, i) => new Promise((res) => Player.find({ group }))
    // ); // [P1, P2, P3, P4];
    // const results = await Promise.all(playersPromises);
    // console.log(results, "res");
    // results.map(async (promise, index) => {
    //   await countPersonalMatches(helper.sameScoreGroupPlayers(promise));
    //   await showGroupStandingsByPersonalMatches(chatId, groups[index]);
    // });
    const players = [];
    for (const group of groups) {
      const res = await Player.find({ group: group });
      players.push({
        group: group,
        players: res,
      });
    }
    for (const player of players) {
      await countPersonalMatches(helper.sameScoreGroupPlayers(player.players));
      await showGroupStandingsByPersonalMatches(chatId, player.group);
    }
    // await countPersonalMatches(helper.sameScoreGroupPlayers(playersA));
    // await showGroupStandingsByPersonalMatches(chatId, "A");
    // await countPersonalMatches(helper.sameScoreGroupPlayers(playersB));
    // await showGroupStandingsByPersonalMatches(chatId, "B");
    // await countPersonalMatches(helper.sameScoreGroupPlayers(playersC));
    // await showGroupStandingsByPersonalMatches(chatId, "C");
    // await countPersonalMatches(helper.sameScoreGroupPlayers(playersD));
    // await showGroupStandingsByPersonalMatches(chatId, "D");
    await createBracket(chatId, 8);
    bot.sendMessage(chatId, "Групповая стадия успешно завершена ГЛ В ПЛЕЙОФЕ");
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
        `result ${player1} ${score1}:${score2} ${player2} is successfully added`
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
  const groupsNumber = tournament.groupsNumber;
  const groups = GROUP_NAMES.slice(0, groupsNumber);
  if (!tournament || tournament?.status !== TOURNAMENT_STATUS.TIEBREAK) {
    bot.sendMessage(chatId, "Тайбрейк стадия не активна");
  } else {
    for (const group of groups) {
      await showFinalStandings(chatId, group);
    }
    // await showFinalStandings(chatId, "A");
    // await showFinalStandings(chatId, "B");
    // await showFinalStandings(chatId, "C");
    // await showFinalStandings(chatId, "D");
    bot.sendMessage(chatId, "Групповая стадия успешно завершена ГЛ В ПЛЕЙОФЕ");
    await createBracket(chatId, 8);

    tournament.status = TOURNAMENT_STATUS.PLAYOFF;
    await tournament.save();
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

            randomResults.push({ name: a.name, value: a.randomNumber });
            i++;
          }
          if (!b.randomNumber) {
            b.randomNumber = randomNumbers[i];
            randomResults.push({ name: b.name, value: b.randomNumber });
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
  const firstMessage = randomResults
    .map((player) => `Random number for ${player.name} is ${player.value}`)
    .join("\n");

  const secondMessage = sortedPlayers
    .map(
      (player, index) =>
        `${index + 1}) ${player.name} ${player.score} pts | ${
          player.personalMatchesScore
        } personal matches score | ${player.tiebreakScore} tiebreak score |  ${
          player.randomNumber ? `${player.randomNumber} random score` : ""
        }`
    )
    .join("\n");
  await bot.sendMessage(chatId, firstMessage);
  await bot.sendMessage(chatId, secondMessage);
  await Promise.all(
    sortedPlayers.map(async (player, index) => {
      await Player.findOneAndUpdate(
        { _id: player._id },
        { $set: { groupPlace: index + 1 } }
      );
    })
  );
}
async function createBracket(chatId, playersInBracket) {
  const tournaments = await Tournament.find().sort({ _id: -1 }).limit(1);
  const tournament = tournaments[0];
  const numberOfGroups = tournament.groupsNumber;
  const groups = GROUP_NAMES.slice(0, numberOfGroups);
  console.log(numberOfGroups, "num");
  if (playersInBracket === 8 && numberOfGroups === 2) {
    const [playersA, playersB] = await Promise.all([
      Player.find({ group: "A" }),
      Player.find({ group: "B" }),
    ]);
    const numberOfPlayers = playersA.length + playersB.length;
    const sortedA = playersA.sort((a, b) => {
      return a.groupPlace - b.groupPlace;
    });
    const sortedB = playersB.sort((a, b) => {
      return a.groupPlace - b.groupPlace;
    });
    if (numberOfPlayers !== playersInBracket) {
      const eliminatedPlayersFromGroup =
        (numberOfPlayers - playersInBracket) / numberOfGroups;
      const eliminatedA = sortedA.splice(-eliminatedPlayersFromGroup);
      const eliminatedB = sortedB.splice(-eliminatedPlayersFromGroup);
      const eliminatedPlace = playersInBracket + 1;
      await Promise.all(
        eliminatedA.map(async (player, index) => {
          let currentPlace = eliminatedPlace;
          await Player.findOneAndUpdate(
            { _id: player._id },
            { $set: { finalPlace: `${currentPlace}-${currentPlace + 1}` } }
          );
          currentPlace += numberOfGroups;
        })
      );
      await Promise.all(
        eliminatedB.map(async (player, index) => {
          let currentPlace = eliminatedPlace;
          await Player.findOneAndUpdate(
            { _id: player._id },
            { $set: { finalPlace: `${currentPlace}-${currentPlace + 1}` } }
          );
          currentPlace += numberOfGroups;
        })
      );
    }
    let reversedPartB = sortedB.slice(1, sortedB.length - 1);
    reversedPartB.push(sortedB[0]);
    reversedPartB.unshift(sortedB[sortedB.length - 1]);
    const reversedB = reversedPartB;
    let reversedPartA = sortedA.slice(1, sortedA.length - 1).reverse();
    reversedPartA.push(sortedA[sortedA.length - 1]);
    reversedPartA.unshift(sortedA[0]);
    const reversedA = reversedPartA;
    const playoffPairs = reversedA.map((player, index) => {
      return {
        score1: "0",
        score2: "0",
        stage: `W-1-${index + 1}`,
        player1: player.name,
        player2: `${reversedB[index].name}`,
      };
    });
    await Playoff.insertMany(playoffPairs);
  } else if (playersInBracket === 8 && numberOfGroups === 4) {
    const allPlayers = await Player.find({});
    const numberOfPlayers = allPlayers.length;
    const playoffPlayers = [];
    for (const group of groups) {
      const groupData = await Player.find({ group });
      const sortedData = groupData.sort((a, b) => {
        return a.groupPlace - b.groupPlace;
      });
      if (numberOfPlayers !== playersInBracket) {
        const eliminatedPlayersFromGroup =
          (numberOfPlayers - playersInBracket) / numberOfGroups;
        const eliminatedPlayers = sortedData.splice(
          -eliminatedPlayersFromGroup
        );
        const eliminatedPlace = playersInBracket + 1;
        await Promise.all(
          eliminatedPlayers.map(async (player, index) => {
            let currentPlace = eliminatedPlace;
            await Player.findOneAndUpdate(
              { _id: player._id },
              {
                $set: {
                  finalPlace: `${currentPlace}-${
                    currentPlace + numberOfGroups - 1
                  }`,
                },
              }
            );
            currentPlace += numberOfGroups;
          })
        );
        playoffPlayers.push(...sortedData);
      }
    }

    // const [playersA, playersB, playersC, playersD] = await Promise.all([
    //   Player.find({ group: "A" }),
    //   Player.find({ group: "B" }),
    //   Player.find({ group: "C" }),
    //   Player.find({ group: "D" }),
    // ]);
    // const sortedA = playersA.sort((a, b) => {
    //   return a.groupPlace - b.groupPlace;
    // });
    // const sortedB = playersB.sort((a, b) => {
    //   return a.groupPlace - b.groupPlace;
    // });
    // const sortedC = playersC.sort((a, b) => {
    //   return a.groupPlace - b.groupPlace;
    // });
    // const sortedD = playersD.sort((a, b) => {
    //   return a.groupPlace - b.groupPlace;
    // });
    // if (numberOfPlayers !== playersInBracket) {
    //   const eliminatedPlayersFromGroup =
    //     (numberOfPlayers - playersInBracket) / numberOfGroups;
    //   const eliminatedA = sortedA.splice(-eliminatedPlayersFromGroup);
    //   const eliminatedB = sortedB.splice(-eliminatedPlayersFromGroup);
    //   const eliminatedC = sortedC.splice(-eliminatedPlayersFromGroup);
    //   const eliminatedD = sortedD.splice(-eliminatedPlayersFromGroup);
    //   const eliminatedPlace = playersInBracket + 1;
    //   await Promise.all(
    //     eliminatedA.map(async (player, index) => {
    //       let currentPlace = eliminatedPlace;
    //       await Player.findOneAndUpdate(
    //         { _id: player._id },
    //         {
    //           $set: {
    //             finalPlace: `${currentPlace}-${
    //               currentPlace + numberOfGroups - 1
    //             }`,
    //           },
    //         }
    //       );
    //       currentPlace += numberOfGroups;
    //     })
    //   );
    //   await Promise.all(
    //     eliminatedB.map(async (player, index) => {
    //       let currentPlace = eliminatedPlace;
    //       await Player.findOneAndUpdate(
    //         { _id: player._id },
    //         {
    //           $set: {
    //             finalPlace: `${currentPlace}-${
    //               currentPlace + numberOfGroups - 1
    //             }`,
    //           },
    //         }
    //       );
    //       currentPlace += numberOfGroups;
    //     })
    //   );
    //   await Promise.all(
    //     eliminatedC.map(async (player, index) => {
    //       let currentPlace = eliminatedPlace;
    //       await Player.findOneAndUpdate(
    //         { _id: player._id },
    //         {
    //           $set: {
    //             finalPlace: `${currentPlace}-${
    //               currentPlace + numberOfGroups - 1
    //             }`,
    //           },
    //         }
    //       );
    //       currentPlace += numberOfGroups;
    //     })
    //   );
    //   await Promise.all(
    //     eliminatedD.map(async (player, index) => {
    //       let currentPlace = eliminatedPlace;
    //       await Player.findOneAndUpdate(
    //         { _id: player._id },
    //         {
    //           $set: {
    //             finalPlace: `${currentPlace}-${
    //               currentPlace + numberOfGroups - 1
    //             }`,
    //           },
    //         }
    //       );
    //       currentPlace += numberOfGroups;
    //     })
    //   );
    // }
    // const playoffPlayers = [];
    // playoffPlayers.push(...sortedA, ...sortedB, ...sortedC, ...sortedD);
    console.log(playoffPlayers, "plfplrs");
    const secondPlacePlayers = [];
    const firstPlacePlayers = playoffPlayers.filter((player) => {
      if (player.groupPlace === 2) {
        secondPlacePlayers.push(player);
      } else {
        return true;
      }
    });
    const secondPlacePlayersReversed = secondPlacePlayers.reverse();
    const playoffPairs = firstPlacePlayers.map((player, index) => {
      return {
        score1: "0",
        score2: "0",
        stage: `W-1-${index + 1}`,
        player1: player.name,
        player2: `${secondPlacePlayersReversed[index].name}`,
      };
    });
    await Playoff.insertMany(playoffPairs);
  }
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
