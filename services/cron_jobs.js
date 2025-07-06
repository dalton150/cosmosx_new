const cron = require("node-cron");
const moment = require("moment-timezone");
const synceBonusData = require("../controller/plan");
console.log("cron job started");


const logWithTime = (msg) => {
    const timeIST = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
    console.log(`[${timeIST} IST] ${msg}`);
};

cron.schedule("*/50 * * * *", async () => {
  logWithTime("⏱ Running 50-min cron job...");
  try {
    await synceBonusData.synceBonusData();
    logWithTime("✅ 50-min job completed");
  } catch (error) {
    logWithTime("❌ Error in 50-min job: " + error.message);
  }
}, {
  timezone: "Asia/Kolkata"
});
