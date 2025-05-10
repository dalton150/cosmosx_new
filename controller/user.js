const User = require("../models/user");
const utility = require("../utility/utility");
const mongoose = require("mongoose");

const registerUser = async (req, res) => {
  try {
    const { walletAddress, referredBy } = req.body;

    if (!walletAddress) return res.status(400).json({ error: "Wallet address required" });

    const existingUser = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (existingUser) return res.status(409).json({ error: "User already registered" });

    // Generate next referral code
    const lastUser = await User.findOne().sort({ createdAt: -1 });
    const nextReferralCode = lastUser ? (parseInt(lastUser.referralCode) + 1).toString() : "1";

    let placementUpline = null;
    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (!referrer) return res.status(404).json({ error: "Referrer not found" });
      placementUpline = await findPlacementUpline(referrer._id);
    } else {
      // If no referral code, find the root/first available
      placementUpline = await findPlacementUpline(null);
    }

    // Create new user
    const newUser = new User({
      walletAddress: walletAddress.toLowerCase(),
      referralCode: nextReferralCode,
      referredBy: referredBy || null,
      placementUpline: placementUpline ? placementUpline.walletAddress : null,
    });

    await newUser.save();

    // Set placement (left/right child)
    if (placementUpline) {
      if (!placementUpline.leftChild) {
        placementUpline.leftChild = newUser.walletAddress;
      } else if (!placementUpline.rightChild) {
        placementUpline.rightChild = newUser.walletAddress;
      }
      await placementUpline.save();
    }

    return res.status(201).json({ message: "User registered", user: newUser });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// const loginUser = async (req, res) => {
//   try {
//     const { walletAddress } = req.body;
//     if (!walletAddress) return res.status(400).json({ error: "Wallet address required" });

//     const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
//     if (!user) return res.status(404).json({ error: "User not found" });

//     return res.status(200).json({ message: "Login successful", user });
//   } catch (err) {
//     console.error("Login error:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// };

async function _doLogin(user, data) {
    let setObj = {
      deviceType: data.deviceType,
      deviceToken: data.deviceToken,
    };
    if (user) {
      user = JSON.parse(JSON.stringify(user));
    }
  
    if (user.isBlocked) {
      return "Your account is blocked by admin";
    }
  
    let jti = utility.generateRandomString(20);
    setObj.jti = jti;
    user = await User
      .findByIdAndUpdate({ _id: user._id }, { $set: setObj })
      .lean();
    user.token = await utility.jwtSign({
      _id: user._id,
      role: "USER",
      jti: jti,
      walletAddress: user.walletAddress,
    });
    user.type = "Bearer";
    user.expire = await utility.getJwtExpireTime();
    user.refreshToken = await utility.jwtRefreshSign({ _id: user._id });
    return user;
  };
  
  async function loginUser(req, res) {
    try {
      let {walletAddress} = req.body;

      let user = await User.findOne({walletAddress:walletAddress.toLowerCase(), isDeleted: false }, {
        isBlocked: 1,
        walletAddress: 1,
      });

      console.log("loginUser", user); 
      
  
      if (!user) {
        return res.status(400).json({ message: "Wrong walletAddress or user not found" });
      }
      // Fetch the full user details after successful authentication
      user = await User.findOne({ _id: user._id });
      console.log("user", user);
      
  
      user = await _doLogin(user, req.body);
      
      return res.status(200).json({ data: user, message: "Login successful" });
  
    } catch (error) {
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  }

// BFS to find top-to-bottom, left-to-right placement
const findPlacementUpline = async (startUserId = null) => {
  const queue = [];

  if (startUserId) {
    const user = await User.findById(startUserId);
    if (user) queue.push(user);
  } else {
    // Find root user (lowest referral code)
    const rootUser = await User.findOne().sort({ referralCode: 1 });
    if (rootUser) queue.push(rootUser);
  }

  while (queue.length) {
    const current = queue.shift();
    if (!current.leftChild || !current.rightChild) return current;

    const leftUser = await User.findOne({ walletAddress: current.leftChild });
    const rightUser = await User.findOne({ walletAddress: current.rightChild });

    if (leftUser) queue.push(leftUser);
    if (rightUser) queue.push(rightUser);
  }

  return null;
};

const getReferrer = async (req,res) => {
  try {
    const {referredBy} = req.body;
    if (!referredBy) return res.status(400).json({ error: "Referral code required" });
    const user = await User.findOne({referralCode: referredBy});
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ message: "Referrer fetched", data: user.walletAddress });
  } catch (err) {
    console.error("Get referrer error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

const getReferrerInternal = async (referredBy) => {
    try {
      const user = await User.findOne({referralCode: referredBy});
      return user;
    } catch (err) {
      console.error("Get referrer error:", err);
    }
  }


module.exports = {
     registerUser, 
     loginUser ,
     findPlacementUpline,
     getReferrer,
     getReferrerInternal,
};
