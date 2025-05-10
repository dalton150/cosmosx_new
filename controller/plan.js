const express = require("express");
const { ethers } = require("ethers");
require("dotenv").config();
const USDC_CONTRACT = process.env.USDC_CONTRACT;

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL_Amoy);
const contractAddress = process.env.PlAN_CONTRACT;
const abi = require("../common/planABI.json");
const tokenAbi = require("../common/tokenABI.json");
const USDC = new ethers.Contract(USDC_CONTRACT, tokenAbi, provider);
const contract = new ethers.Contract(contractAddress, abi, provider);

function buildTxData(functionFragment, args) {
  const iface = new ethers.utils.Interface(abi);
  return iface.encodeFunctionData(functionFragment, args);
}

function buildTxDataToken(functionFragment, args) {
  const iface = new ethers.utils.Interface(tokenAbi);
  return iface.encodeFunctionData(functionFragment, args);
}

const register = async (req, res) => {
    const { userAddress, referrer } = req.body;
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

const upgradeSlot = async (req, res) => {
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

const getDirectLength = async (req, res) => {
    const { userAddress } = req.body;
    const length = await contract.getDirectLength(userAddress);
    return res.send({data:length});
}

const getDirects = async (req, res) => {
    const { userAddress } = req.body;
    const directs = await contract.getDirects(userAddress);
    return res.send({data:directs});
}

const getTeamTree = async (req, res) => {
    const { userAddress } = req.body;
    const tree = await contract.getTeamTree(userAddress);
    return res.send({data:tree});
}

const distributeRoyalty = async (req, res) => {
    const { userAddress, usersList,slot } = req.body;
    const data = buildTxData("distributeRoyalty", [slot, usersList]);
    const tx = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
    return res.send({data:tx});
}

const adminActivateSlot = async (req, res) => {
    const { userAddress, slot } = req.body;
    const data = buildTxData("adminActivateSlot", [slot]);
    const tx = {
      to: contractAddress,
      data,
      from: userAddress,
      value: 0,
    };
    return res.send({data:tx});
}





module.exports = {
    register,
    approveSlot,
    upgradeSlot,
    setAutoUpgrade,
    getDirectLength,
    getDirects,
    getTeamTree,
    distributeRoyalty,
    getSlotPrices,
}



