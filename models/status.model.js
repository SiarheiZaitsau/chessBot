const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const Status = new Schema({
  started: {
    type: Boolean,
    required: true,
  },
});

mongoose.model("status", Status);
