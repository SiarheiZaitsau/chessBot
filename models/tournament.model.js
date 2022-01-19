const mongoose = require("mongoose");

const Schema = mongoose.Schema;

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
});

const Tournament = mongoose.model("tournament", TournamentSchema);
module.exports = {
  Tournament,
  TOURNAMENT_STATUS,
};
