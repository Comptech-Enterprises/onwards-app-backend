const { ErrorLog } = require("../models");

async function listErrorLogs(req, res) {
  const { level, limit } = req.query;
  const maxItems = Math.min(Number(limit) || 100, 500);

  const query = {};
  if (level && level !== "all") {
    query.level = level;
  }

  const items = await ErrorLog.find(query)
    .sort({ created_at: -1 })
    .limit(maxItems);

  res.json(items);
}

async function deleteErrorLog(req, res) {
  const { logId } = req.params;
  await ErrorLog.deleteOne({ id: logId });
  res.json({ ok: true });
}

module.exports = { listErrorLogs, deleteErrorLog };
