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
  opponents: {
    type: [],
    default: [],
  }
});


mongoose.model("players", PlayerSchema);


