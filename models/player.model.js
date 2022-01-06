const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  group: {
    type: String,
  },
  score: {
    type: Number,
  },
});
const Status = new Schema({
  started: {
    type: Boolean,
    required: true,
  },
});
const Results = new Schema({
  player1: {
    type: String,
    required: true,
  },
  score1: {
    type: Number,
    required: true,
  },
  player2: {
    type: String,
    required: true,
  },
  score2: {
    type: Number,
    required: true,
  },
});

mongoose.model("players", PlayerSchema);

mongoose.model("status", Status);

mongoose.model("results", Results);
