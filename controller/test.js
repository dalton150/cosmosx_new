const U = require("./user");
const plan = require("../controller/plan");
 const triggerEvaluateActivation = async () => {
    try {
        const users = await U.getAllUsersInternal();
        for (const user of users) {
            const res = await plan.evaluateActivation(user);
            if (res) {
                console.log(`Activation evaluated for user: ${user}`);
            } else {
                console.log(`No activation needed for user: ${user}`);
            }
        }
    } catch (error) {
        console.error("Trigger evaluate activation error:", error);
    }
  }


module.exports = {
    triggerEvaluateActivation,
}