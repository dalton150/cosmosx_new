const mongoose = require("mongoose");

var mongoDbconnection = async function () {
  // var url = config.get("mongo.url");
  var url = process.env.MONGO_URL;
  console.log(url);
  await mongoose.connect(url);
};

module.exports = {
  mongoDbconnection: mongoDbconnection,
};
