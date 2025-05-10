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


module.exports = router;