const {
  generateAndSendDailyReport,
  generateAndSendWeeklyReport,
  generateAndSendMonthlyReport,
  generateAndSendQuarterlyReport,
  cleanupMonthlyImages,
  cleanupQuarterlyData,
} = require("../services/reportService");

async function sendDaily(req, res) {
  try {
    const { date, recipients } = req.body || {};
    const info = await generateAndSendDailyReport(date, recipients);
    res.json({ ok: true, message: "Daily report sent successfully.", messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function sendWeekly(req, res) {
  try {
    const { startDate, endDate, recipients } = req.body || {};
    const info = await generateAndSendWeeklyReport(startDate, endDate, recipients);
    res.json({ ok: true, message: "Weekly report sent successfully.", messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function sendMonthly(req, res) {
  try {
    const { year, month, recipients } = req.body || {};
    const info = await generateAndSendMonthlyReport(year, month, recipients);
    res.json({ ok: true, message: "Monthly report sent & image cleanup executed.", messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function sendQuarterly(req, res) {
  try {
    const { year, quarter, recipients } = req.body || {};
    const info = await generateAndSendQuarterlyReport(year, quarter, recipients);
    res.json({ ok: true, message: "Quarterly report sent & 90-day data retention executed.", messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function triggerImageCleanup(req, res) {
  try {
    const { monthPrefix } = req.body || {};
    if (!monthPrefix) return res.status(400).json({ ok: false, error: "monthPrefix (e.g. '2026-08') is required." });
    const result = await cleanupMonthlyImages(monthPrefix);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function triggerQuarterlyDataCleanup(req, res) {
  try {
    const { cutoffDate } = req.body || {};
    const result = await cleanupQuarterlyData(cutoffDate);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  sendDaily,
  sendWeekly,
  sendMonthly,
  sendQuarterly,
  triggerImageCleanup,
  triggerQuarterlyDataCleanup,
};
