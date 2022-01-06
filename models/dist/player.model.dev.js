"use strict";

var mongoose = require("mongoose");

var Schema = mongoose.Schema;
var PlayerSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  group: {
    type: String
  },
  score: {
    type: Number
  }
});
var Status = new Schema({
  started: {
    type: Boolean,
    required: true
  }
});
var Results = new Schema({
  player1: {
    type: String,
    required: true
  },
  score1: {
    type: Number,
    required: true
  },
  player2: {
    type: String,
    required: true
  },
  score2: {
    type: Number,
    required: true
  }
});
mongoose.model("players", PlayerSchema);
mongoose.model("status", Status);
mongoose.model("results", Results);