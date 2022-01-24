const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  group: {
    type: String,
    default: "",
  },
  score: {
    type: Number,
    default: 0,
  },
  personalMatchesScore: {
    type: Number,
    default: 0,
  },
});

const Player = mongoose.model("players", PlayerSchema);

module.exports = {
  Player,
};
