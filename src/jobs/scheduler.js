const cron = require("node-cron");
const {
  generateAndSendDailyReport,
  generateAndSendWeeklyReport,
  generateAndSendMonthlyReport,
  generateAndSendQuarterlyReport,
} = require("../services/reportService");

function initSchedulers() {
  const timezone = process.env.APP_TIMEZONE || "Asia/Kolkata";
  console.log(`[SCHEDULER] Initializing automated report schedulers (Timezone: ${timezone})...`);

  // 1. Daily Report: Every day at 18:30 IST (6:30 PM) -> Ravi Pawar & Abhishek Gupta
  cron.schedule(
    "30 18 * * *",
    async () => {
      console.log("[CRON] Running Daily Operations Report Job...");
      try {
        await generateAndSendDailyReport();
      } catch (err) {
        console.error("[CRON ERROR] Daily Report failed:", err.message);
      }
    },
    { timezone }
  );
  console.log("[SCHEDULER] Registered Daily Report Job (30 18 * * *)");

  // 2. Weekly Report: Every Monday at 09:00 IST (9:00 AM) -> Mannat Jain & Vineeta Sanduja
  cron.schedule(
    "0 9 * * 1",
    async () => {
      console.log("[CRON] Running Weekly Operations Review Job...");
      try {
        await generateAndSendWeeklyReport();
      } catch (err) {
        console.error("[CRON ERROR] Weekly Report failed:", err.message);
      }
    },
    { timezone }
  );
  console.log("[SCHEDULER] Registered Weekly Report Job (0 9 * * 1)");

  // 3. Monthly Report + Image Cleanup: 1st of every month at 09:00 IST -> Ravi, Abhishek, Vineeta & Mannat
  cron.schedule(
    "0 9 1 * *",
    async () => {
      console.log("[CRON] Running Monthly Report & Image Cleanup Job...");
      try {
        const now = new Date();
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const year = prevMonthDate.getFullYear();
        const month = prevMonthDate.getMonth() + 1;
        await generateAndSendMonthlyReport(year, month);
      } catch (err) {
        console.error("[CRON ERROR] Monthly Report failed:", err.message);
      }
    },
    { timezone }
  );
  console.log("[SCHEDULER] Registered Monthly Report Job (0 9 1 * *)");

  // 4. Quarterly Report + 90-Day Data Retention Cleanup: 1st of Jan, Apr, Jul, Oct at 09:30 IST -> Vineeta, Mannat & Anil Purdhani
  cron.schedule(
    "30 9 1 1,4,7,10 *",
    async () => {
      console.log("[CRON] Running Quarterly Executive Report & 90-Day Data Retention Job...");
      try {
        const now = new Date();
        const currentQuarter = Math.floor((now.getMonth() + 3) / 3);
        const prevQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
        const year = currentQuarter === 1 ? now.getFullYear() - 1 : now.getFullYear();
        await generateAndSendQuarterlyReport(year, prevQuarter);
      } catch (err) {
        console.error("[CRON ERROR] Quarterly Report failed:", err.message);
      }
    },
    { timezone }
  );
  console.log("[SCHEDULER] Registered Quarterly Report Job (30 9 1 1,4,7,10 *)");
}

module.exports = { initSchedulers };
