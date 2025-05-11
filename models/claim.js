const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const claimModel = mongoose.model("Claim", claimSchema);

module.exports = claimModel;
