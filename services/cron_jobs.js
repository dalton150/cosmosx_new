const cron = require("node-cron");
const testController = require("../controller/test");
const moment = require("moment-timezone");

console.log("cron job started");



const logWithTime = (msg) => {
    const timeIST = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
    console.log(`[${timeIST} IST] ${msg}`);
};

cron.schedule("*/5 * * * *", async () => {
    logWithTime("⏱ Running 5-min cron job...");
    try {
       await testController.triggerEvaluateActivation();
      logWithTime("✅ 5-min job completed");
    } catch (error) {
      logWithTime("❌ Error in 5-min job: " + error.message);
    }
  }, {
    timezone: "Asia/Kolkata"
});


cron.schedule("0 12 * * *", async () => {
    logWithTime("⏱ Running daily 12PM cron job...");
    try {
       await testController.triggerEvaluateActivation();
       logWithTime("12PM job completed");
    } catch (error) {
      logWithTime("Error in 12PM job: " + error.message);
    }
  }, {
    timezone: "Asia/Kolkata"
});
