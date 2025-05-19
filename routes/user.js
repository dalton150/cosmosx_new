const express = require('express');
const router = express.Router();
const userController = require('../controller/user');
const planController = require('../controller/plan');
const userAuth = require("../services/auth");

//========================= User Routes =========================
router.post('/signUp', userController.registerUser);
router.post('/login', userController.loginUser);
router.post("/getReferrer", userController.getReferrer);
router.post("/createClaim", userController.createClaim);
router.get("/getUserData",userAuth.userAuth, userController.getUserData);
router.post("/getClaimTransaction",userAuth.userAuth, userController.getClaimTransaction);
router.get("/getAllUsersCount", userController.getAllUsersCount);
router.post("/getCommunityTeam",userController.getCommunityTeam);



//========================= Plan Routes =========================
router.post('/register',planController.register);
router.post('/approve',planController.approveSlot);
router.post('/upgradeSlot',planController.upgradeSlot);
router.post("/setAutoUpgrade",planController.setAutoUpgrade);
router.post("/claimEarnings",planController.claimEarnings);
router.post("/getDirectLength",planController.getDirectLength);
router.post("/getDirects",planController.getDirects);
router.post("/getTeamTree",planController.getTeamTree);
router.post("/getUserInfo",planController.getUserInfo);
router.post("/getEarnings",planController.getEarnings);
router.post("/getUserSlots",planController.getUserSlots);
router.post("/getRoyaltyPerSlot",planController.getRoyaltyPerSlot);
router.post("/distributeRoyalty",planController.distributeRoyalty);
router.post("/adminActivateSlot",planController.adminActivateSlot);
// router.post("/evaluateActivation",planController.evaluateActivation);
router.post("/getTodaysBonus",planController.getTodaysBonus);
router.post("/getPackagePrices",planController.getPackagePrices);
router.post("/getRecentBonus",planController.getRecentBonus);

router.post("/purchaseSlotTest",planController.purchaseSlotTest);
router.post("/getTotalDeposit",planController.getTotalDeposit);
router.post("/getLevelBonus",planController.getLevelBonus);
router.post("/isEligibleForIncome",planController.isEligibleForIncome);
router.post("/getLostIncomeData",planController.getLostIncomeData);
router.post("/getRewardBonus",planController.getRewardBonus);


module.exports = router;