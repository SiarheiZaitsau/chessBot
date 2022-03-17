const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const prizePool = 150;
const GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "J"];
const PRIZES = [
  Math.ceil(prizePool * 0.33),
  Math.ceil(prizePool * 0.22),
  Math.ceil(prizePool * 0.1333),
  prizePool * 0.1,
  Math.ceil(prizePool * 0.0533),
  Math.ceil(prizePool * 0.0533),
  Math.ceil(prizePool * 0.0333),
  Math.ceil(prizePool * 0.0333),
  prizePool * 0.01,
  prizePool * 0.01,
  prizePool * 0.01,
  prizePool * 0.01,
];
const TOURNAMENT_STATUS = {
  REGISTRATION: "REGISTRATION",
  GROUPS: "GROUPS",
  TIEBREAK: "TIEBREAK",
  PLAYOFF: "PLAYOFF",
  COMPLETED: "COMPLETED",
};

const TournamentSchema = new Schema({
  status: {
    type: String,
    required: true,
    default: TOURNAMENT_STATUS.ANNOUNCED,
    enum: TOURNAMENT_STATUS,
  },
  groupsNumber: {
    type: Number,
    required: true,
    default: 0,
  },
});

const Tournament = mongoose.model("tournament", TournamentSchema);
module.exports = {
  Tournament,
  TOURNAMENT_STATUS,
  GROUP_NAMES,
  PRIZES,
};
