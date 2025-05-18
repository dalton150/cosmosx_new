const express = require("express");
const { ethers } = require("ethers");
require("dotenv").config();
const user = require("../controller/user");
const USDC_CONTRACT = process.env.USDC_CONTRACT;

const provider = new ethers.providers.JsonRpcProvider("https://rpc-amoy.polygon.technology");
const contractAddress = process.env.PlAN_CONTRACT;
const abi = require("../common/planAbi.json");
const tokenAbi = require("../common/tokenAbi.json");
const USDC = new ethers.Contract(USDC_CONTRACT, tokenAbi, provider);
const contract = new ethers.Contract(contractAddress, abi, provider);
const wallet = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
// console.log("wallet", wallet);

const plan = new ethers.Contract(contractAddress, abi, wallet);
const token = new ethers.Contract(USDC_CONTRACT, tokenAbi, wallet);

const priceArray = [
  4e6, 5e6, 10e6, 20e6, 40e6, 80e6, 160e6, 320e6,
  640e6, 1280e6, 2560e6, 5120e6, 10240e6, 20480e6, 40960e6
];


function buildTxData(functionFragment, args) {
  const iface = new ethers.utils.Interface(abi);
  return iface.encodeFunctionData(functionFragment, args);
}

function buildTxDataToken(functionFragment, args) {
  const iface = new ethers.utils.Interface(tokenAbi);
  return iface.encodeFunctionData(functionFragment, args);
}

const register = async (req, res) => {  // done 
    const { userAddress, referralCode } = req.body;
    if (!ethers.utils.isAddress(userAddress)) {
      return res.status(400).send({ message: "Invalid user address" });
    }
    console.log("register",userAddress,referralCode);
    const referredBy = await user.getReferrerInternal(referralCode);
    console.log("referredBy",referredBy);
    
    if (!referredBy) {
      return res.status(400).send({ message: "Referrer not found" });
    }
    const referrer = referredBy.walletAddress;
    const data = buildTxData("register", [referrer]);
    const tx = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
    return res.send({data:tx});
}

const approveSlot = async (req,res) => {
  const {userAddress,amount} = req.body;
  if (!ethers.utils.isAddress(userAddress)) {
    return res.status(400).send({ message: "Invalid user address" });
  }
  const data = buildTxDataToken("approve", [contractAddress, amount]);
  const tx = {
    to: USDC_CONTRACT,
    data,
    from: userAddress,
    value: 0,
  };
  return res.send({data:tx});
}

const approve = async (userAddress,amount) => {
    const data = buildTxDataToken("approve", [contractAddress, amount]);
    const tx = {
      to: USDC_CONTRACT,
      data,
      from: userAddress,
      value: 0,
    };
    return tx;
}
 const approveTest = async (amount) => {
  try {
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), 6); // USDC has 6 decimals

    const gasPrice = await provider.getGasPrice();
    const nonce = await provider.getTransactionCount(await wallet.getAddress());

    console.log("Approving:", parsedAmount.toString());

    const tx = await token.approve(contractAddress, parsedAmount, {
      gasLimit: 100000,        // Safe limit
      gasPrice: gasPrice,      // Current network price
      nonce: nonce             // Ensures correct transaction order
    });

    console.log("Tx sent:", tx.hash);

    const receipt = await tx.wait(1); // Wait for 1 confirmation
    console.log("Tx mined:", receipt.transactionHash);
    return receipt;
  } catch (err) {
    console.error("Error in approveTest:", err);
  }
}

const getSlotPrices = async (userAddress,slot) => {
    const price = await contract.getSlotPrice(userAddress,slot);
    const decimals = await USDC.decimals();
    console.log("decimals",decimals);
    
    const priceInUnits = ethers.utils.formatUnits(price, decimals);
    const priceInNumber = parseFloat(priceInUnits);
    console.log("priceInNumber",priceInNumber);
    return priceInNumber;
    // return res.send({data:priceInNumber});
}

const upgradeSlot = async (req, res) => {  // done
    const { userAddress, slot } = req.body;
    const data = buildTxData("purchaseSlot", [slot]);
    const data1 = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
    return res.send({data1:data1});
}

const purchaseSlotTest = async (req, res) => {
  try {
    const {userAddress, slot } = req.body;

    const amount = await getSlotPrices(userAddress,slot);
    console.log("Slot price:", amount);

    const ap = await approveTest(amount);
    console.log("Approved tx:", ap);

    const gasPrice = await provider.getGasPrice();
    console.log("Gas price:", gasPrice.toString());
    const nonce = await provider.getTransactionCount(await wallet.getAddress());
    console.log("Nonce:", nonce.toString());

    const tx = await plan.purchaseSlot(slot, {
      gasLimit: 1000000,
      gasPrice,
      nonce
    });

    console.log("purchaseSlot tx sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("purchaseSlot tx confirmed:", receipt.transactionHash);

    return res.send({ data: receipt });
  } catch (error) {
    console.error("Error in purchaseSlotTest:", error);
    return res.status(500).send({ message: "Internal server error", error: error.message });
  }
};

const setAutoUpgrade = async (req, res) => {
    const { userAddress, enabled } = req.body;
    const data = buildTxData("setAutoUpgrade", [enabled]);
    const tx = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
    return res.send({data:tx});
}

const claimEarnings = async (req, res) => {
    const { userAddress } = req.body;
    const data = buildTxData("claimEarnings", []);
    const tx = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
    return res.send({data:tx});
}

const getDirectLength = async (req, res) => {
    const { userAddress } = req.body;
    const length = await contract.getDirectLength(userAddress);
    // handle decimals if needed
    const lengthInNumber = Number(length);
    return res.send({data:lengthInNumber});
}

const getDirects = async (req, res) => {
    const { userAddress } = req.body;
    const directs = await contract.getDirects(userAddress);
    return res.send({data:directs});
}

const getTeamTree = async (req, res) => {
    const { userAddress } = req.body;
    const tree = await contract.getTeamTree(userAddress);
    const treeObj = {
        left: tree[0],
        right: tree[1],
        leftLeft: tree[2],
        leftRight: tree[3],
        rightLeft: tree[4],
        rightRight: tree[5]
    };
    return res.send({data:treeObj});
}

const distributeRoyalty = async (req, res) => {
    let { userAddress,slot,amount } = req.body;
    console.log("distributeRoyalty",userAddress,slot,amount);
    amount = Number(amount)*1e6;
    console.log("amount",amount);
    const data = buildTxData("distributeRoyaltyLevelWise", [slot,amount]);
    const tx = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
    return res.send({data:tx});
}

const adminActivateSlot = async (req, res) => {
    const {yourWallet, userAddress, slot } = req.body;
    const data = buildTxData("adminActivateSlot", [userAddress,slot]);
    const tx = {
      to: contractAddress,
      data,
      from: yourWallet,
      value: 0,
    };
    return res.send({data:tx});
}

const getUserInfo = async (req, res) => {
    const { userAddress } = req.body;
    const userInfo = await contract.users(userAddress);
    let userInfoObj = {
        referrer: userInfo[0],
        placementUpline: userInfo[1],
        left: userInfo[2],
        right: userInfo[3],
        registeredAt:Number(userInfo[4]),
        activatedAt: Number(userInfo[5]),
        activeSlots: Number(userInfo[6]),
        isFlipped: userInfo[7],
        autoUpgrade: userInfo[8],
        savedForUpgrade: Number(userInfo[9])/1e6,
        exists: userInfo[10],
        isActive: userInfo[11],
        lastIncomeAt: Number(userInfo[12]),
    };
    return res.send({data:userInfoObj});
}

const getEarnings = async (req, res) => {
    const { userAddress } = req.body;
    const earnings = await contract.getEarningsBreakdown(userAddress);
    console.log("earnings",earnings);
    let earningsObj = {
        directBonus: Number(earnings[0])/1e6,
        uplineBonus: Number(earnings[1])/1e6,
        levelBonus: Number(earnings[2])/1e6,
        leftOver: Number(earnings[3])/1e6,
        royaltyBonus: Number(earnings[4])/1e6,
        totalClaimed: Number(earnings[5])/1e6,
    };
    console.log("earningsObj",earningsObj);
    return res.send({data:earningsObj});
}

const getUserSlots = async (req, res) => {
    const { userAddress,slot } = req.body;
    const slots = await contract.userSlots(userAddress,slot);
    return res.send({data:slots});
}

const getRoyaltyPerSlot = async (req, res) => {
    const { slot } = req.body;
    const royalty = await contract.royaltyPerSlot(slot);
    const decimals = await USDC.decimals();
    const royaltyInUnits = Number(royalty)/Math.pow(10,decimals);
    return res.send({data:royaltyInUnits});
}


const getTodaysBonus = async (req, res) => {
    const { userAddress } = req.body;
    const bonus = await contract.getTodaysBonus(userAddress);
    console.log("bonus",bonus);
    
    return res.send({data:bonus});
}

const getPackagePrices = async (req, res) => {
    const {userAddress, slot } = req.body;
    const packagePrices = await contract.getSlotPrice(userAddress,slot);
    const price = Number(packagePrices)/1e6;
    return res.send({data:price});
}

const getRecentBonus = async (req, res) => {
  try {
    const { userAddress } = req.body;
    // Validate address
    if (!ethers.utils.isAddress(userAddress)) {
      return res.status(400).send({ message: "Invalid address" });
    }
    // Let's try fetching the latest N bonus records (e.g., last 10)
    let recentBonuses = [];
    let index = 0;
    // Try fetching bonuses until it reverts or fails
    while (true) {
      try {
        const bonus = await contract.bonusHistory(userAddress, index);
        recentBonuses.push({
          amount: ethers.utils.formatUnits(bonus.amount, 6), // Adjust decimals
          bonusType: bonus.bonusType,
          timestamp: Number(bonus.timestamp),
        });
        index++;
      } catch (err) {
        // Break the loop if index is out of range (no more bonuses)
        break;
      }
    }
    return res.status(200).send({ data: recentBonuses });
  } catch (err) {
    console.error("Error fetching bonus history:", err);
    return res.status(500).send({ message: "Internal server error" });
  }
};


const userOf = async (userAddress) => {
  const userInfo = await contract.users(userAddress);
  let userInfoObj = {
      referrer: userInfo[0],
      placementUpline: userInfo[1],
      left: userInfo[2],
      right: userInfo[3],
      registeredAt:Number(userInfo[4]),
      activatedAt: Number(userInfo[5]),
      activeSlots: Number(userInfo[6]),
      isFlipped: userInfo[7],
      autoUpgrade: userInfo[8],
      savedForUpgrade: Number(userInfo[9])/1e6,
      exists: userInfo[10],
      isActive: userInfo[11],
      lastIncomeAt: Number(userInfo[12]),
  };
  return userInfoObj;
}

const getTotalDeposit = async (req, res) => {
  const { userAddress } = req.body;
  const getUser = await userOf(userAddress);
  const { activeSlots } = getUser;

  let totalDeposit = 0;
  for (let i = 0; i < activeSlots; i++) {
    totalDeposit += priceArray[i];
  }

  return res.send({ data: totalDeposit/1e6 });
};

const distributeRewardAdmin = async(req,res) => {
  let {walletAddress,userAddress,amount} = req.body;

  const data = buildTxData("distributeReward", [user,amount]);
    const tx = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
}

const getLevelBonus = async (req,res) => {
  const {userAddress} = req.body;
  let levelBonus =  await contract.levelBonus(userAddress);
  levelBonus = Number(levelBonus)*1e6;
  return res.send({Bonus:levelBonus}); 
}

const isEligibleForIncome = async (req,res) => {
  const {userAddress} = req.body;
  let isEligible = await contract.isEligibleForIncome(userAddress);
  return res.send({data:isEligible});
}

const getLostIncomeData = async (req,res) => {
  const {userAddress} = req.body;
  let lostData = await contract.getLostIncomeDetails(userAddress);
  console.log("lostData==>",lostData);
  const lostObj = {
    totalLost: Number(lostData[0])*1e6,
    todayLost: Number(lostData[1])*1e6,
    yesterdayLost: Number(lostData[2])*1e6,
    slotWiseLost: lostData[3]
  }
  console.log("lostObj==>",lostObj);
  return res.send({data:lostObj});
}






module.exports = {
    register,
    approveSlot,
    upgradeSlot,
    setAutoUpgrade,
    claimEarnings,
    getDirectLength,
    getDirects,
    getTeamTree,
    distributeRoyalty,
    getSlotPrices,
    adminActivateSlot,
    getUserInfo,
    getEarnings,
    getUserSlots,
    getRoyaltyPerSlot,
    getTodaysBonus,
    getPackagePrices,
    getRecentBonus,
    purchaseSlotTest,
    getTotalDeposit,
    getLevelBonus,
    isEligibleForIncome,
    getLostIncomeData,
}



