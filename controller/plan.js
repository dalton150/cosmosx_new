const express = require("express");
const { ethers } = require("ethers");
require("dotenv").config();

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL_Amoy);
const contractAddress = process.env.PlAN_CONTRACT;
const abi = require("../common/planABI.json");
const contract = new ethers.Contract(contractAddress, abi, provider);

function buildTxData(functionFragment, args) {
  const iface = new ethers.utils.Interface(abi);
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