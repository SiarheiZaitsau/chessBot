const { Tournament, TOURNAMENT_STATUS, GROUP_NAMES } = require("../models/tournament.model");
const { Player } = require("../models/player.model");
require("../models/tournament.model");
const { Playoff, PLAYOFF_STATUS } = require("../models/playoff.model");
require("../models/playoff.model");
const { Result } = require("../models/result.model");
require("../models/result.model");
module.exports = {
  async addResult(bot, id, string) {
    const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });
    const stage = tournament?.status;
    const splitted = string.replace(/ +(?= )/g, "").split(" ");
    const player1 = splitted[0].toLowerCase();
    const splittedScore = splitted[1].split(":");
    const score1 = parseFloat(splittedScore[0].replace(",", "."));
    const score2 = parseFloat(splittedScore[1].replace(",", "."));
    const link = splitted[3] || undefined;
    const player2 = splitted[2].toLowerCase();
    if ((score1 + score2) % 1 > 0) {
      bot.sendMessage(id, "Некорректный счет матча");
      throw new Error("Incorrect score");
    }
    switch (stage) {
      case TOURNAMENT_STATUS.GROUPS:
        addGroupResult(bot, player1, player2, score1, score2, link, id);
        break;
      case TOURNAMENT_STATUS.PLAYOFF:
        addPlayoffResult(bot, player1, player2, score1, score2, link, id);
        break;
      case TOURNAMENT_STATUS.TIEBREAK:
        addTiebreakResult(bot, player1, player2, score1, score2, link, id);
    }
  },
};

async function addGroupResult(bot, player1, player2, score1, score2, link, id) {
  const [player1Data, player2Data] = await Promise.all([
    Player.findOne({ name: player1 }),
    Player.findOne({ name: player2 }),
  ]);
  const stage = TOURNAMENT_STATUS.GROUPS;
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

    if (player1Data.group !== player2Data.group && stage === TOURNAMENT_STATUS.GROUPS) {
      bot.sendMessage(id, `игроки находятся в разных группах`);
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
        Player.findOneAndUpdate({ _id: player1Data._id }, { $inc: { score: score1 } }),
        Player.findOneAndUpdate({ _id: player2Data._id }, { $inc: { score: score2 } }),
        new Result({
          player1: player1Data._id,
          score1,
          player2: player2Data._id,
          score2,
          link,
        }).save(),
      ]);
      bot.sendMessage(id, `Результат ${player1} ${score1}:${score2} ${player2} успешно добавлен`);
    }
  } else if (!player1Data) {
    bot.sendMessage(id, `Неверное имя участника ${player1}`);
  } else if (!player2Data) {
    bot.sendMessage(id, `Неверное имя участника ${player2}`);
  } else {
    bot.sendMessage(id, `Ошибка. Результат матча не был добавлен`);
  }
}

async function addTiebreakResult(player1, player2, score1, score2, link, id) {
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
        Player.findOneAndUpdate({ _id: player1Data._id }, { $inc: { tiebreakScore: score1 } }),
        Player.findOneAndUpdate({ _id: player2Data._id }, { $inc: { tiebreakScore: score2 } }),
        new Result({
          player1: player1Data._id,
          score1,
          player2: player2Data._id,
          score2,
          stage: TOURNAMENT_STATUS.TIEBREAK,
          link: link,
        }).save(),
      ]);
      bot.sendMessage(id, `result ${player1} ${score1}:${score2} ${player2} is successfully added`);
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
async function addPlayoffResult(bot, player1, player2, score1, score2, link, id) {
  const match = await Playoff.findOne({
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

  console.log(match, "match");
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
      case PLAYOFF_STATUS.ROUND1_WINNERS_MATCH1:
      case PLAYOFF_STATUS.ROUND1_WINNERS_MATCH2:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);

          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH1 }),
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH1 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH1, player1: winner }),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH1, player1: looser }),
            ]);
          } else {
            Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH1, player1: winner }),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH1, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND1_WINNERS_MATCH3:
      case PLAYOFF_STATUS.ROUND1_WINNERS_MATCH4:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH2 }),
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH2 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH2 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH2 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH2, player1: winner }),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH2 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH2 },
                { player2: winner }
              ),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH2, player1: looser }),
            ]);
          } else {
            Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_WINNERS_MATCH2, player1: winner }),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND1_LOSERS_MATCH2, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND1_LOSERS_MATCH1:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const newMatchWinner = await Playoff.findOne({
            stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1,
          });
          if (newMatchWinner) {
            await Playoff.updateOne(
              { stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1 },
              { player2: winner }
            );
          } else {
            await Playoff.create({
              stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1,
              player1: winner,
            });
          }
          await Player.findOneAndUpdate({ name: looser }, { $set: { finalPlace: "7-8" } });
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND1_LOSERS_MATCH2:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const newMatchWinner = await Playoff.findOne({
            stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2,
          });
          if (newMatchWinner) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2 },
                { player2: winner }
              ),
            ]);
          } else {
            await Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2, player1: winner }),
            ]);
          }
          await Player.findOneAndUpdate({ name: looser }, { $set: { finalPlace: "7-8" } });
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND2_WINNERS_MATCH1:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1 }),
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1, player1: winner }),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1, player1: looser }),
            ]);
          } else {
            await Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1, player1: winner }),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND2_WINNERS_MATCH2:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1 }),
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1, player1: winner }),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2, player1: looser }),
            ]);
          } else {
            await Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1, player1: winner }),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND2_LOSERS_MATCH1:
      case PLAYOFF_STATUS.ROUND2_LOSERS_MATCH2:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const newMatchWinner = await Playoff.findOne({
            stage: PLAYOFF_STATUS.ROUND3_LOSERS_MATCH1,
          });
          if (newMatchWinner) {
            await Playoff.updateOne(
              { stage: PLAYOFF_STATUS.ROUND3_LOSERS_MATCH1 },
              { player2: winner }
            );
          } else {
            await Playoff.create({
              stage: PLAYOFF_STATUS.ROUND3_LOSERS_MATCH1,
              player1: winner,
            });
          }
          await Player.findOneAndUpdate({ name: looser }, { $set: { finalPlace: "5-6" } });
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND3_LOSERS_MATCH1:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const newMatchWinner = await Playoff.findOne({
            stage: PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1,
          });
          if (newMatchWinner) {
            await Playoff.updateOne(
              { stage: PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1 },
              { player2: winner }
            );
          } else {
            await Playoff.create({
              stage: PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1,
              player1: winner,
            });
          }
          await Player.findOneAndUpdate({ name: looser }, { $set: { finalPlace: "4" } });
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND3_WINNERS_MATCH1:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const [newMatchWinner, newMatchLooser] = await Promise.all([
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1 }),
            Playoff.findOne({ stage: PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1 }),
          ]);
          if (newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (!newMatchWinner && newMatchLooser) {
            await Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1, player1: winner }),
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1 },
                { player2: looser }
              ),
            ]);
          } else if (newMatchWinner && !newMatchLooser) {
            await Promise.all([
              Playoff.updateOne(
                { stage: PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1 },
                { player2: winner }
              ),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1, player1: looser }),
            ]);
          } else {
            await Promise.all([
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1, player1: winner }),
              Playoff.create({ stage: PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1, player1: looser }),
            ]);
          }
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND4_LOSERS_MATCH1:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);
          const newMatchWinner = await Playoff.findOne({
            stage: PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1,
          });
          if (newMatchWinner) {
            await Playoff.updateOne(
              { stage: PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1 },
              { player2: winner }
            );
          } else {
            await Playoff.create({
              stage: PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1,
              player1: winner,
            });
          }
          await Player.findOneAndUpdate({ name: looser }, { $set: { finalPlace: "3" } });
          bot.sendMessage(
            id,
            `result ${player1} ${score1}:${score2} ${player2} is successfully added`
          );
        }
        break;
      case PLAYOFF_STATUS.ROUND4_WINNERS_MATCH1:
        {
          processPlayoffMatch(match, player1, player2, score1, score2, link);

          await Player.findOneAndUpdate({ name: looser }, { $set: { finalPlace: "2" } });
          await Player.findOneAndUpdate({ name: winner }, { $set: { finalPlace: "1" } });
          await Playoff.updateOne(
            {
              $and: [{ player1: player2 }, { player2: player1 }, { stage: match.stage }],
            },
            { score1: score2, score2: score1 }
          );
          const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });
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
async function processPlayoffMatch(match, player1, player2, score1, score2, link) {
  const [player1Data, player2Data] = await Promise.all([
    Player.findOne({ name: player1 }),
    Player.findOne({ name: player2 }),
  ]);
  new Result({
    player1: player1Data._id,
    score1,
    player2: player2Data._id,
    score2,
    stage: match.stage,
    link,
  }).save();
  if (player1 === match.player1) {
    await Playoff.findOneAndUpdate(
      {
        $and: [{ player1: player1 }, { player2: player2 }],
      },
      { $set: { score1, score2 } }
    );
    console.log("first");
  } else {
    await Playoff.findOneAndUpdate(
      {
        $and: [{ player1: player2 }, { player2: player1 }],
      },
      { $set: { score1: score2, score2: score1 } }
    );
    console.log("second");
  }
}
