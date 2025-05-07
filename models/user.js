const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
    },
    leftChild: {
        type: String,
        default: null,
    },
    rightChild: {
        type: String,
        default: null,
    },
    slots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stake' }],
    depositAmount: {
      type: Number,
      default: 0,
    },
    referralCode: { 
      type: String, 
      unique: true 
    },
    referredBy: { 
        type: String, 
        default: null 
    },
    directBonus: {
        type: Number,
        default: 0
    },
    royaltyBonus: {
        type: Number,
        default: 0
    },
    totalEarnings: {
        type: Number,
        default: 0
    },
    deviceType: { 
        type: String, 
        default: "" 
    },
    deviceToken: { 
        type: String, 
        default: "" 
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

const userModel = mongoose.model("User", userSchema);

module.exports = userModel;
