const { ReviewCheck } = require("../models");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getReviewChecks(req, res) {
  const periodKey = req.query.date || todayKey();

  const items = await ReviewCheck.find({ periodKey });

  const checks = {};
  for (const row of items) {
    if (!checks[row.category]) checks[row.category] = {};
    if (!checks[row.category][row.location]) checks[row.category][row.location] = {};
    checks[row.category][row.location][row.taskId] = row.checked_at;
  }
  res.json(checks);
}

async function checkReviewTask(req, res) {
  const { category, location, taskId } = req.body;
  const userId = req.user.id;
  const periodKey = todayKey();
  const sortKey = `${category}#${location}#${taskId}`;

  if (!category || !location || !taskId) {
    return res.status(400).json({ error: "Category, location, and task ID required." });
  }

  const existing = await ReviewCheck.findOne({
    periodKey,
    cat_loc_task: sortKey,
  });

  if (existing) {
    return res.status(400).json({ ok: false, error: "Ticked items cannot be unmarked." });
  }

  await ReviewCheck.create({
    periodKey,
    cat_loc_task: sortKey,
    category,
    location,
    taskId,
    reviewer_id: userId,
    checked_at: new Date().toISOString(),
  });

  res.json({ ok: true });
}

module.exports = { getReviewChecks, checkReviewTask };
