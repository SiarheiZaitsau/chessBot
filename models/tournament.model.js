const mongoose = require("mongoose");

const Schema = mongoose.Schema;

export const TOURNAMENT_STATUS = {
  REGISTRATION: 'REGISTRATION',
  GROUPS: 'GROUPS',
  TIEBREAK: 'TIEBREAK',
  PLAYOFF: 'PLAYOFF',
  COMPLETED: 'COMPLETED'
}

const TournamentSchema = new Schema({
  status: {
    type: String,
    required: true,
    default: TOURNAMENT_STATUS.REGISTRATION,
    enum: TOURNAMENT_STATUS,
  },
});

export default mongoose.model("tournament", TournamentSchema);
