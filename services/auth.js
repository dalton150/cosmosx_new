const jwt = require("jsonwebtoken");
// const secretKey = "sumo";
require("dotenv").config();
const response = require("../utility/response");
const responseCode = require("../utility/responseCode");
const Utility = require("../utility/utility");
const userModel = require("../models/user");
// const secretKey = process.env.JWT_SECRET;

const userAuth = async (req, res, next) => {
  try {
    if (req && req.user && req.user.guestMode) {
      next();
    } else if (req && req.headers.authorization) {
      const accessTokenFull = req.headers.authorization;
      let accessToken = "";
      if (accessTokenFull.startsWith("Bearer")) {
        accessToken = accessTokenFull.substr("Bearer".length + 1);
      } else {
        const parts = accessTokenFull.split(" ");
        accessToken = parts[1];
      }
      console.log("accessToken: ", accessToken);
      const decodeData = await Utility.jwtVerify(accessToken);
      console.log("decodeData: ", decodeData);
      if (!decodeData) throw process.lang.INVALID_TOKEN;
      const userData = await userModel
        .findOne({
           _id: decodeData._id,
           isDeleted: false,
            isBlocked: false,
         })
        .lean()
        .exec();
      if (userData) {
        req.user = userData;
        req.user.forResetPassword = decodeData.forResetPassword;
        req.user.userType = "USER";
        next();
      } else {
        return response.sendFailResponse(
          req,
          res,
          responseCode.UN_AUTHORIZED,
          process.lang.INVALID_TOKEN
        );
      }
    } else {
      return response.sendFailResponse(
        req,
        res,
        responseCode.UN_AUTHORIZED,
        process.lang.INVALID_TOKEN
      );
    }
  } catch (error) {
    next(error);
  }
};
module.exports = { userAuth};
