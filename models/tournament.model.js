const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "J"];
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
};
