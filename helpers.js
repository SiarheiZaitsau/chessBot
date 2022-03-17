// const bot = require("./bot");
// const mongoose = require("mongoose");
const { Player } = require("./models/player.model");
require("./models/player.model");
const { Playoff } = require("./models/playoff.model");
require("./models/playoff.model");
const { Tournament, TOURNAMENT_STATUS, GROUP_NAMES } = require("./models/tournament.model");
const { Result } = require("./models/result.model");
require("./models/result.model");

module.exports = {
  debug(obj) {
    return JSON.stringify(obj, null, 4);
  },

  getChatId(msg) {
    return msg.chat.id;
  },

  shuffle(array) {
    let currentIndex = array.length,
      randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
  },
  generateRandomNumbers(players, f) {
    const numbers = Array(100)
      .fill()
      .map((_, index) => index + 1);
    numbers.sort(() => Math.random() - 0.5);
    return numbers;
  },
  groupByScore: groupByScore,

  sameScoreGroupPlayers: (group) =>
    groupByScore(group, function (player) {
      return [player.score];
    }),
  sameScoreAndPersonalMatchesGroupPlayers: (group) =>
    groupByScore(group, function (player) {
      return [player.score, player.personalMatchesScore];
    }),
  sameTiebreakPlayers: (group) =>
    groupByScore(group, function (player) {
      return [player.score, player.personalMatchesScore, player.tiebreakScore];
    }),
  splitArrayIntoChunksOfLen: (arr, len) => {
    const chunks = [];
    i = 0;
    n = arr.length;
    while (i < n) {
      chunks.push(arr.slice(i, (i += len)));
    }
    return chunks;
  },
  async countPersonalMatches(groupPlayers) {
    for (group of groupPlayers) {
      // console.log(group, "group");
      if (group.length > 1) {
        // Promise.all(
        await Promise.all(
          group.map(async (player, index, players) => {
            if (index < players.length - 1) {
              for (let i = 1; i < players.length - index; i++) {
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
  },
  async createBracket(chatId, playersInBracket) {
    const tournament = await Tournament.findOne({}, {}, { sort: { created_at: -1 } });
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
        const eliminatedPlayersFromGroup = (numberOfPlayers - playersInBracket) / numberOfGroups;
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
      let playoffPlayers = [];
      for (const group of groups) {
        const groupData = await Player.find({ group });
        const sortedData = groupData.sort((a, b) => {
          return a.groupPlace - b.groupPlace;
        });
        if (numberOfPlayers !== playersInBracket) {
          const eliminatedPlayersFromGroup = (numberOfPlayers - playersInBracket) / numberOfGroups;
          const eliminatedPlayers = sortedData.splice(-eliminatedPlayersFromGroup);
          const eliminatedPlace = playersInBracket + 1;
          await Promise.all(
            eliminatedPlayers.map(async (player, index) => {
              let currentPlace = eliminatedPlace;
              await Player.findOneAndUpdate(
                { _id: player._id },
                {
                  $set: {
                    finalPlace: `${currentPlace}-${currentPlace + numberOfGroups - 1}`,
                  },
                }
              );
              currentPlace += numberOfGroups;
            })
          );
          playoffPlayers.push(...sortedData);
        } else {
          playoffPlayers.push(...sortedData);
        }
      }
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
      console.log(playoffPairs, "pairs");
      await Playoff.insertMany(playoffPairs);
    }
  },
  async sendGroup(bot, chatId, group) {
    await bot.sendMessage(chatId, `Group ${group}`);
    await this.sendPlayers(bot, chatId, { group });
  },

  async assignGroups(numberOfGroups) {
    const players = await Player.find({});
    const shuffledPlayers = this.shuffle(players);
    const numberOfPlayers = shuffledPlayers.length;
    const numberOfPlayersInGroup = numberOfPlayers / numberOfGroups;
    const playersInGroup = this.splitArrayIntoChunksOfLen(shuffledPlayers, numberOfPlayersInGroup);
    const groupsIds = playersInGroup.map((players) => {
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
  },
  async sendPlayers(bot, chatId, query) {
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
  },
};

function groupByScore(players, f) {
  // вынести
  const groups = {};
  players.forEach(function (player) {
    const group = JSON.stringify(f(player));
    groups[group] = groups[group] || [];
    groups[group].push(player);
  });
  return Object.keys(groups).map(function (group) {
    return groups[group];
  });
}
