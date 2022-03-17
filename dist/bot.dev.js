"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var TelegramBot = require("node-telegram-bot-api");

var helper = require("./helpers");

var token = "5075310188:AAFJJAPibPicZEzZl9M--T7ULy8kfQ6tI8A";

var axios = require("axios");

var mongoose = require("mongoose");

var MONGODB_URI = "mongodb+srv://oslan228:papech364@telegram.nnwcf.mongodb.net/telegram?retryWrites=true&w=majority";
var bot = new TelegramBot(token, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});
mongoose.connect(MONGODB_URI).then(function () {
  return console.log("connected");
})["catch"](function (err) {
  return console.log("error is: ".concat(err));
});
helper.logStart();

require("./models/player.model");

var Player = mongoose.model("players");
var Status = mongoose.model("status"); // ================

function checkUniquePlayer(chatId, query) {
  return regeneratorRuntime.async(function checkUniquePlayer$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          Player.find(query).then(function (player) {
            console.log(player);

            if (player.length > 0) {
              bot.sendMessage(chatId, "user ".concat(query.name, " is already registred"));
            } else {
              axios.get("https://lichess.org/api/user/".concat(query.name)).then(function (response) {
                new Player({
                  name: query.name,
                  group: "",
                  score: 0
                }).save()["catch"](function (e) {
                  console.log(e);
                  bot.sendMessage(chatId, "Error");
                });
                bot.sendMessage(chatId, "Player ".concat(query.name, " is Succesfully regisred"));
                console.log(response);
              })["catch"](function (error) {
                bot.sendMessage(chatId, "Incorrect username");
                console.log(error);
              });
            }
          });

        case 1:
        case "end":
          return _context.stop();
      }
    }
  });
}

bot.onText(/\/register (.+)/, function (msg, _ref) {
  var _ref2 = _slicedToArray(_ref, 2),
      source = _ref2[0],
      match = _ref2[1];

  var id = msg.chat.id;
  var name = match.match(/[^\/]+$/)[0];
  checkUniquePlayer(id, {
    name: name
  });
});

function sendPlayers(chatId, query) {
  Player.find(query).then(function (players) {
    var res = players.map(function (player, index) {
      return "".concat(index + 1, " ").concat(player.name);
    }).join("\n");
    bot.sendMessage(chatId, res);
  });
}

bot.onText(/\/players/, function (msg, _ref3) {
  var _ref4 = _slicedToArray(_ref3, 2),
      source = _ref4[0],
      match = _ref4[1];

  var id = msg.chat.id;
  sendPlayers(id, {});
}); //   console.log("Working", msg.from.first_name);
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
  var currentIndex = array.length,
      randomIndex; // While there remain elements to shuffle...

  while (currentIndex != 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--; // And swap it with the current element.

    var _ref5 = [array[randomIndex], array[currentIndex]];
    array[currentIndex] = _ref5[0];
    array[randomIndex] = _ref5[1];
  }

  return array;
}

function addGroups() {
  var array, shuffeled, idsA, idsB;
  return regeneratorRuntime.async(function addGroups$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(Player.find({}));

        case 2:
          array = _context2.sent;
          shuffeled = shuffle(array);
          idsA = [];
          idsB = [];
          shuffeled.forEach(function (item, index) {
            if (index % 2 === 0) {
              idsA.push(item._id);
            } else {
              idsB.push(item._id);
            }
          });
          console.log(idsA, "a");
          console.log(idsB, "b");
          _context2.next = 11;
          return regeneratorRuntime.awrap(Player.updateMany({
            _id: {
              $in: idsA
            }
          }, {
            $set: {
              group: "A"
            }
          }));

        case 11:
          _context2.next = 13;
          return regeneratorRuntime.awrap(Player.updateMany({
            _id: {
              $in: idsB
            }
          }, {
            $set: {
              group: "B"
            }
          }));

        case 13:
        case "end":
          return _context2.stop();
      }
    }
  });
}

function startTournament(chatId) {
  var status;
  return regeneratorRuntime.async(function startTournament$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return regeneratorRuntime.awrap(Status.findOne());

        case 2:
          status = _context3.sent;

          if (!(status.started === true)) {
            _context3.next = 7;
            break;
          }

          bot.sendMessage(chatId, "tournament is already started");
          _context3.next = 21;
          break;

        case 7:
          status.started = true;
          _context3.t0 = regeneratorRuntime;
          _context3.t2 = status.save().then(addGroups()).then(bot.sendMessage(chatId, "tournament has been succesfully started")).then(bot.sendMessage(chatId, "Group A"));
          _context3.next = 12;
          return regeneratorRuntime.awrap(sendPlayers(chatId, {
            group: "A"
          }));

        case 12:
          _context3.t3 = _context3.sent;
          _context3.t4 = bot.sendMessage(chatId, "Group B");
          _context3.t1 = _context3.t2.then.call(_context3.t2, _context3.t3).then(_context3.t4);
          _context3.next = 17;
          return regeneratorRuntime.awrap(sendPlayers(chatId, {
            group: "B"
          }));

        case 17:
          _context3.t5 = _context3.sent;
          _context3.t6 = _context3.t1.then.call(_context3.t1, _context3.t5);
          _context3.next = 21;
          return _context3.t0.awrap.call(_context3.t0, _context3.t6);

        case 21:
        case "end":
          return _context3.stop();
      }
    }
  });
}

bot.onText(/\/start/, function (msg) {
  var id = msg.chat.id;
  startTournament(id);
});

function addResult(id, string) {
  var splitted, player1, splittedScore, score1, score2, player2;
  return regeneratorRuntime.async(function addResult$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          splitted = string.split(" ");
          player1 = splitted[0];
          splittedScore = splitted[1].split(":");
          console.log(splittedScore, "splittedScore");
          score1 = parseFloat(splittedScore[0].replace(",", "."));
          score2 = parseFloat(splittedScore[1].replace(",", "."));
          player2 = splitted[2];
          console.log(player1, "player1");
          console.log(score1, "score1");
          console.log(player2, "player2");
          console.log(score2, "score2");
          console.log(score1 + score2, "sum");

          if (!((score1 + score2) % 1 > 0)) {
            _context4.next = 15;
            break;
          }

          bot.sendMessage(id, "incorrect score entry");
          throw new Error("Incorrect score");

        case 15:
          _context4.next = 17;
          return regeneratorRuntime.awrap(Player.findOneAndUpdate({
            name: player1
          }, {
            $inc: {
              score: score1
            }
          }, function (err, doc) {
            if (err) console.log("Something wrong when updating data!");
            console.log(doc);
          }));

        case 17:
          _context4.next = 19;
          return regeneratorRuntime.awrap(Player.findOneAndUpdate({
            name: player2
          }, //
          {
            $inc: {
              score: score2
            }
          }, function (err, doc) {
            if (err) console.log("Something wrong when updating data!");
            console.log(doc);
          }));

        case 19:
          bot.sendMessage(id, "result ".concat(string, " is sucesfully added"));

        case 20:
        case "end":
          return _context4.stop();
      }
    }
  });
}

bot.onText(/\/addResult (.+)/, function (msg, _ref6) {
  var _ref7 = _slicedToArray(_ref6, 2),
      source = _ref7[0],
      match = _ref7[1];

  var id = msg.chat.id;
  addResult(id, match);
});
bot.on("polling_error", console.log);