const jwt = require("jsonwebtoken"); 
var crypto = require("crypto");
const config = require("../config/config.json");
const bcrypt = require("bcrypt");

console.log(config.jwtOption.jwtSecretKey);
console.log(config.jwtOption.expiresIn);

module.exports = {
  // Sign the JWT token and add it to the response
  jwtSign: async (payload) => {
    try {
      const token = jwt.sign(payload, config.jwtOption.jwtSecretKey);
      console.log("token: ", token);

      return token;
    } catch (error) {
      throw error;
    }
  },
  jwtRefreshSign: async (payload) => {
    try {
      return jwt.sign(payload, config.jwtOption.jwtRefreshSecretKey), {
        expiresIn: config.jwtOption.expiresIn,
      };
    } catch (error) {
      throw error;
    }
  },

  jwtRefreshVerify: async (token) => {
    return jwt.verify(token, config.jwtOption.jwtRefreshSecretKey);
  },
  jwtVerify: async (token) => {
    return jwt.verify(token, config.jwtOption.jwtSecretKey);
  },
  getJwtExpireTime: async () => {
    return parseInt(config.jwtOption.expiresIn.replace("s", ""));
  },

  hashed_password: async (password) => {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      return hashedPassword;
    } catch (error) {
      throw error;
    }
  },
  comparePasswordUsingBcrypt: async (pass, hash) => {
    return bcrypt.compareSync(pass, hash);
  },
  generateRandomString: (n) => {
    return crypto.randomBytes(n).toString("hex");
  },

  generateRandomString: (n) => {
    return crypto.randomBytes(n).toString("hex");
  },
  getServerCurrentTime: async () => {
    return Math.floor(new Date().getTime() / 1000);
  },
  isEmail: (value) => {
    let re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(value).toLowerCase());
  },

  isPhone: (value) => {
    let intRegex = /[0-9 -()+]+$/;
    return intRegex.test(value);
  },
};
