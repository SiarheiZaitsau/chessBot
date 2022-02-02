const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const TiebreakSchema = new Schema({
  player1: {
    type: String,
  },
  player1Id: {
    type: ObjectId,
  },
  player1Score: {
    type: Number,
    default: 0,
  },
  player2: {
    type: String,
  },
  player2Id: {
    type: ObjectId,
  },
  player2Score: {
    type: Number,
    default: 0,
  },
});

const Tiebreak = mongoose.model("tiebreak", TiebreakSchema);
module.exports = {
  Tiebreak,
};
