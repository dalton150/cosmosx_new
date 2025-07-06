const mongoose = require("mongoose");

const bonusSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  index: { type: Number, required: true },
  amount: { type: Number, required: true },
  bonusType: { type: String, required: true },
  timestamp: { type: Number, required: true },
  fromSlot: { type: Number }, // optional
});

bonusSchema.index({ walletAddress: 1, index: 1 }, { unique: true });

module.exports = mongoose.model("Bonus", bonusSchema);
