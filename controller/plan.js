const express = require("express");
const { ethers } = require("ethers");
require("dotenv").config();
const user = require("../controller/user");
const USDC_CONTRACT = process.env.USDC_CONTRACT;

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL_Amoy, {
  name: "polygon-amoy",
  chainId: 80002, // Amoy Testnet Chain ID
});

const contractAddress = process.env.PlAN_CONTRACT;
const abi = require("../common/planAbi.json");
const tokenAbi = require("../common/tokenAbi.json");
const USDC = new ethers.Contract(USDC_CONTRACT, tokenAbi, provider);
const contract = new ethers.Contract(contractAddress, abi, provider);
const wallet = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
// console.log("wallet", wallet);

const plan = new ethers.Contract(contractAddress, abi, wallet);


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
    const referredBy = await user.getReferrerInternal(referralCode);
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

const getSlotPrices = async (slot) => {
    const price = await contract.getSlotPrice(slot);
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
    const amount = await getSlotPrices(slot);
    const data0 = await approve(userAddress, amount);
    const data = buildTxData("purchaseSlot", [slot]);
    const data1 = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
    return res.send({data0:data0, data1:data1});
}

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
    let { userAddress,level,amount } = req.body;
    console.log("distributeRoyalty",userAddress,level,amount);
    amount = Number(amount)*1e6;
    console.log("amount",amount);
    const data = buildTxData("distributeRoyaltyLevelWise", [level,amount]);
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
    let earningsObj = {
        directBonus: Number(earnings[0])/1e6,
        levelBonus: Number(earnings[1])/1e6,
        uplineBonus: Number(earnings[2])/1e6,
        royaltyBonus: Number(earnings[3])/1e6,
        totalClaimed: Number(earnings[4])/1e6,
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

const evaluateActivation = async (userAddress) => {
  try {
    const result  = await plan.evaluateActivation(userAddress);
    return result;
  } catch (error) {
    console.error("Error in evaluateActivation:", error);
  }
}


const getTodaysBonus = async (req, res) => {
    const { userAddress } = req.body;
    const bonus = await contract.getTodaysBonus(userAddress);
    console.log("bonus",bonus);
    
    return res.send({data:bonus});
}

const getPackagePrices = async (req, res) => {
    const { slot } = req.body;
    const packagePrices = await contract.getSlotPrice(slot);
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
    evaluateActivation,
    getTodaysBonus,
    getPackagePrices,
    getRecentBonus,
}



