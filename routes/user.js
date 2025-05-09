const express = require('express');
const router = express.Router();
const userController = require('../controller/user');
const planController = require('../controller/plan');
const userAuth = require("../services/auth");

//========================= User Routes =========================
router.post('/signUp', userController.registerUser);
router.post('/login', userController.loginUser);



//========================= Plan Routes =========================
router.post('/register',planController.register);
router.post('/approve',planController.approveSlot);
router.post('/upgradeSlot',planController.upgradeSlot);
router.post("/setAutoUpgrade",planController.setAutoUpgrade);
router.post("/getDirectLength",planController.getDirectLength);
router.post("/getDirects",planController.getDirects);
router.post("/getTeamTree",planController.getTeamTree);
router.post("/getUserInfo",planController.getUserInfo);
router.post("/getEarnings",planController.getEarnings);
router.post("/getUserSlots",planController.getUserSlots);
router.post("/getRoyaltyPerSlot",planController.getRoyaltyPerSlot);
router.post("/distributeRoyalty",planController.distributeRoyalty);
router.post("/adminActivateSlot",planController.adminActivateSlot);


module.exports = router;