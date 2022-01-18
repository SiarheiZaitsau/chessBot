const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const StatusSchema = new Schema({
  tournamentStatus: {
    type: String,
    required: true,
    default: "registration",
    enum: ["registration", "groupstage", "playoff"],
  },
});

mongoose.model("status", StatusSchema);
