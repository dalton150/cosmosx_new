const User = require("../models/user");
const utility = require("../utility/utility");
const mongoose = require("mongoose");
const claimModel = require("../models/claim");
const Bonus = require("../models/bonus");

const registerUser = async (req, res) => {
  try {
    const { walletAddress, referredBy } = req.body;

    if (!walletAddress) return res.status(400).json({ error: "Wallet address required" });

    const existingUser = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    console.log("existingUser==>",existingUser);
    
    if (existingUser) return res.status(409).json({ error: "User already registered" });

    // Generate next referral code
    const lastUser = await User.findOne().sort({ createdAt: -1 });
    const lastReferralNumber = lastUser?.referralCode?.replace(/^EAGL/, '') || "0";
    const nextReferralCode = `EAGL${parseInt(lastReferralNumber) + 1}`;

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
      console.log("getReferrerInternal", user);
      
      return user;
    } catch (err) {
      console.error("Get referrer error:", err);
    }
}

  const createClaim = async (req, res) => {
    try {
      const { userAddress,hash, amount } = req.body;
      if (!userAddress || !hash || !amount) return res.status(400).json({ error: "All fields are required" });
      const data = {
        walletAddress: userAddress.toLowerCase(),
        hash,
        amount,
      };
      const claim = new claimModel(data);
      await claim.save();
      return res.status(201).json({ message: "Claim created", claim });
    } catch (err) {
      console.error("Create claim error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  const getUserData = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).lean();
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.status(200).json({ message: "User data fetched", user });
    } catch (err) {
      console.error("Get user data error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  const getClaimTransaction = async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const { walletAddress } = req.body;
  
      if (!walletAddress) {
        return res.status(400).json({ error: "walletAddress is required" });
      }
  
      const query = {
        walletAddress: walletAddress.toLowerCase(),
      };
  
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await claimModel.countDocuments(query);
  
      const claims = await claimModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
  
      return res.status(200).json({
        success: true,
        data: claims,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("Get claim transaction error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  };
  

  const getAllUsersInternal = async () => {
    try {
        const users = await User.find({ isDeleted: false }, { walletAddress: 1 }).lean();
        // console.log("All users:",  users.map(user => user.walletAddress));
        return users.map(user => user.walletAddress);
    } catch (error) {
        console.error("Get all users error:", error);
    }
  }

  const getAllUsersCount = async (req, res) => {
    try {
        const userCount = await User.countDocuments({ isDeleted: false });
        return res.status(200).json({ message: "All users fetched", userCount });
    } catch (error) {
        console.error("Get all users error:", error);
        return res.status(500).json({ error: "Server error" });
    }
  }

  const getDirectTeam = async (req, res) => {
    try {
        const {walletAddress} = req.body;
        const { page = 1, limit = 10} = req.query;
        if (!walletAddress) {
            return res.status(400).json({ error: "walletAddress is required" });
        }

        const u = await User.findOne({ walletAddress: walletAddress.toLowerCase()});
        if(!u) {
            return res.status(400).json({ error: "user not found" });
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get total direct referrals using walletAddress
        const total = await User.countDocuments({ isDeleted: false, referredBy: u.referralCode });

        // Get direct users
        const users = await User.find({ isDeleted: false, referredBy: u.referralCode })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Map users with their directCount
        const userData = await Promise.all(users.map(async (user) => {
            const directCount = await User.countDocuments({ isDeleted: false, referredBy: user.referralCode });
            return {
                walletAddress: user.walletAddress,
                referralCode: user.referralCode,
                referredBy: user.referredBy,
                directCount
            };
        }));

        return res.status(200).json({
            success: true,
            data: userData,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit),
            },
        }); 
    } catch (error) {
        console.error("Get direct team error:", error);
        return res.status(500).json({ error: "Server error" });   
    }
};


// const getCommunityTeam = async (req, res) => {
//   try {
//     const { walletAddress } = req.body;
//     const rootUser = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

//     if (!rootUser) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     let queue = [rootUser];
//     let levels = [];

//     while (queue.length > 0) {
//       const levelSize = queue.length;
//       const currentLevel = [];
//       const nextQueue = [];

//       // Collect all walletAddresses to fetch in batch
//       const walletAddressesToFetch = [];

//       for (let i = 0; i < levelSize; i++) {
//         const user = queue[i];

//         if (user) {
//           currentLevel.push({
//             walletAddress: user.walletAddress,
//             referralCode: user.referralCode,
//             referredBy: user.referredBy,
//           });

//           if (user.leftChild) walletAddressesToFetch.push(user.leftChild);
//           if (user.rightChild) walletAddressesToFetch.push(user.rightChild);
//         } else {
//           currentLevel.push(null);
//           nextQueue.push(null, null);
//         }
//       }

//       // Fetch all left/right children in bulk
//       const children = await User.find({ walletAddress: { $in: walletAddressesToFetch } }).lean();
//       const walletMap = new Map(children.map(u => [u.walletAddress, u]));

//       // Populate next level queue
//       for (let i = 0; i < levelSize; i++) {
//         const user = queue[i];

//         if (user) {
//           const left = user.leftChild ? walletMap.get(user.leftChild) || null : null;
//           const right = user.rightChild ? walletMap.get(user.rightChild) || null : null;

//           nextQueue.push(left);
//           nextQueue.push(right);
//         }
//       }

//       // Check if nextQueue has real users
//       const hasRealNodes = nextQueue.some(u => u !== null);
//       levels.push(currentLevel);

//       if (!hasRealNodes) break;
//       queue = nextQueue;
//     }

//     res.json({ root: walletAddress, downline: levels });
//   } catch (err) {
//     console.error('Error fetching downline users:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

const getCommunityTeam = async (req, res) => {
  try {
    const { walletAddress } = req.body;

    const rootUser = await User.findOne(
      { walletAddress: walletAddress.toLowerCase() },
      "walletAddress referralCode referredBy leftChild rightChild"
    ).lean();

    if (!rootUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let queue = [rootUser];
    const levels = [];
    const MAX_LEVELS = 35; // safety cutoff to avoid runaway growth

    while (queue.length > 0 && levels.length < MAX_LEVELS) {
      const currentLevel = [];
      const walletAddressesToFetch = [];

      // Collect all users at this level
      for (const user of queue) {
        if (user) {
          currentLevel.push({
            walletAddress: user.walletAddress,
            referralCode: user.referralCode,
            referredBy: user.referredBy,
          });

          if (user.leftChild) walletAddressesToFetch.push(user.leftChild);
          if (user.rightChild) walletAddressesToFetch.push(user.rightChild);
        } else {
          // keep position (null placeholder)
          currentLevel.push(null);
        }
      }

      levels.push(currentLevel);

      if (walletAddressesToFetch.length === 0) break;

      // Fetch next level in bulk
      const children = await User.find(
        { walletAddress: { $in: walletAddressesToFetch } },
        "walletAddress referralCode referredBy leftChild rightChild"
      ).lean();

      const walletMap = new Map(children.map((u) => [u.walletAddress, u]));

      // Build next queue only from real users
      const nextQueue = [];
      for (const user of queue) {
        if (user) {
          nextQueue.push(user.leftChild ? walletMap.get(user.leftChild) || null : null);
          nextQueue.push(user.rightChild ? walletMap.get(user.rightChild) || null : null);
        }
        // 🚨 removed the null → null expansion
      }

      // Stop if all nulls
      if (!nextQueue.some((u) => u !== null)) break;

      queue = nextQueue;
    }

    return res.json({ root: walletAddress, downline: levels });
  } catch (err) {
    console.error("Error fetching downline users:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const getCommunitySize = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const rootUser = await User.findOne(
      { walletAddress: walletAddress.toLowerCase() },
      "walletAddress leftChild rightChild"
    ).lean();

    if (!rootUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🚀 Fetch all users in one query (only required fields)
    const allUsers = await User.find(
      {},
      "walletAddress leftChild rightChild"
    ).lean();

    // Create quick lookup map
    const userMap = new Map(allUsers.map((u) => [u.walletAddress, u]));

    // BFS traversal without extra DB calls
    let count = 0;
    const queue = [rootUser];

    while (queue.length > 0) {
      const current = queue.shift();

      if (current.leftChild && userMap.has(current.leftChild)) {
        queue.push(userMap.get(current.leftChild));
        count++;
      }

      if (current.rightChild && userMap.has(current.rightChild)) {
        queue.push(userMap.get(current.rightChild));
        count++;
      }
    }

    return res.json({ walletAddress, downlineCount: count });
  } catch (error) {
    console.error("Error in getCommunitySize:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


const getRecentBonus = async (req, res) => {
  try {
    const { userAddress} = req.body;
    const { page = 1, limit = 100 } = req.query;

    if (!userAddress) {
      return res.status(400).json({ message: "userAddress is required" });
    }

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    const query = { walletAddress: userAddress.toLowerCase() };

    const total = await Bonus.countDocuments(query);

    const data = await Bonus.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("Error in getRecentBonus:", err);
    res.status(500).json({ message: "Server error" });
  }
};




 




module.exports = {
     registerUser, 
     loginUser ,
     findPlacementUpline,
     getReferrer,
     getReferrerInternal,
     createClaim,
     getUserData,
     getAllUsersInternal,
     getClaimTransaction,
     getAllUsersCount,
     getCommunityTeam,
     getCommunitySize,
     getDirectTeam,
     getRecentBonus,
};
