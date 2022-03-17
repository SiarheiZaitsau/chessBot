const LICHESS_API = "https://lichess.org/api/user";

const TGBotParams = {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10,
    },
  },
};
const token = "5075310188:AAFJJAPibPicZEzZl9M--T7ULy8kfQ6tI8A";

const MONGODB_URI =
  "mongodb+srv://oslan228:papech364@telegram.nnwcf.mongodb.net/telegram?retryWrites=true&w=majority";
module.exports = {
  LICHESS_API,
  TGBotParams,
  token,
  MONGODB_URI,
};
