const mongoose = require("mongoose");

const Schema = mongoose.Schema;

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

mongoose.model("results", Results);