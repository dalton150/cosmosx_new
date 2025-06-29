const mongoose = require("mongoose");

const lotteryDrawSchema = new mongoose.Schema({
  slot: { type: Number, required: true },
  lastDrawAt: { type: Date, default: Date.now },
});

const LotteryDraw = mongoose.model("LotteryDraw", lotteryDrawSchema);

module.exports = LotteryDraw;
