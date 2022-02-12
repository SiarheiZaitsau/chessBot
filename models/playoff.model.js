const mongoose = require("mongoose");
require("./player.model");

const Schema = mongoose.Schema;

const PLAYOFF_STATUS = {
  ROUND1_WINNERS_MATCH1: "W-1-1",
  ROUND1_WINNERS_MATCH2: "W-1-2",
  ROUND1_WINNERS_MATCH3: "W-1-3",
  ROUND1_WINNERS_MATCH4: "W-1-4",
  ROUND1_LOSERS_MATCH1: "L-1-1",
  ROUND1_LOSERS_MATCH2: "L-1-2",
  ROUND2_LOSERS_MATCH1: "L-2-1",
  ROUND2_LOSERS_MATCH2: "L-2-2",
  ROUND2_WINNERS_MATCH1: "W-2-1",
  ROUND2_WINNERS_MATCH2: "W-2-2",
  ROUND3_LOSERS_MATCH1: "L-3-1",
  ROUND3_WINNERS_MATCH1: "W-3-1",
  ROUND4_LOSERS_MATCH1: "L-4-1",
  ROUND4_WINNERS_MATCH1: "W-4-1",
};

const PlayoffSchema = new Schema({
  player1: {
    type: String,
    default: "",
  },
  score1: {
    type: Number,
    default: 0,
  },
  player2: {
    type: String,
    default: "",
  },
  score2: {
    type: Number,
    default: 0,
  },
  stage: {
    type: String,
  },
});

const Playoff = mongoose.model("playoff", PlayoffSchema);

module.exports = {
  Playoff,
  PLAYOFF_STATUS,
};
