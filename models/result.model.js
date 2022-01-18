const mongoose = require("mongoose");
require("./player.model");
const Schema = mongoose.Schema;

const Player = mongoose.model("players");

const ResultsSchema = new Schema({
  player1: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: Player,
  },
  score1: {
    type: Number,
    required: true,
  },
  player2: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: Player,
  },
  score2: {
    type: Number,
    required: true,
  },
  stage: {
    type: String,
    default: "groupStage",
  },
  link: {
    type: String,
  },
});

mongoose.model("results", ResultsSchema);
