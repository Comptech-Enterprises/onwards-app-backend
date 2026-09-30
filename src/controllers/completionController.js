const { Completion, User } = require("../models");
const { broadcast } = require("../ws");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getPeerUserIds(userId, location = null) {
  try {
    const user = await User.findOne({ id: userId });
    if (!user) return [userId];

    const emps = await User.find({ role: "employee" });

    const isCM = user.designation === "cm";
    const loc = location || (user.location !== "All centres" ? user.location : null);

    if (isCM) {
      if (loc && loc !== "All centres") {
        const centreSupervisors = emps.filter(
          (e) => e.location === loc && e.designation !== "cm"
        );
        return centreSupervisors.length > 0 ? centreSupervisors.map(e => e.id) : [userId];
      }
      return [userId];
    }

    if (loc && loc !== "All centres") {
      const exactLocPeers = emps
        .filter(p => p.location === loc && p.designation !== "cm")
        .map(p => p.id);
      return exactLocPeers.length > 0 ? exactLocPeers : [userId];
    }

    return [userId];
  } catch (err) {
    console.error("Error getting peer user IDs:", err);
    return [userId];
  }
}

async function getCompletions(req, res) {
  const userId = req.params.userId || req.user.id;
  const periodKey = req.query.date || todayKey();

  const items = await Completion.find({ periodKey, userId });

  const completions = {};
  for (const row of items) {
    completions[row.taskId] = row.completed_at;
  }
  res.json(completions);
}

async function getAllCompletions(req, res) {
  const periodKey = req.query.date || todayKey();

  const items = await Completion.find({ periodKey });

  const completions = {};
  for (const row of items) {
    if (!completions[row.userId]) completions[row.userId] = {};
    completions[row.userId][row.taskId] = row.completed_at;
  }
  res.json(completions);
}

async function toggleTask(req, res) {
  const { taskId } = req.params;
  const forUserId = req.body?.forUserId;
  const location = req.body?.location;
  let userId = req.user.id;

  if (forUserId && forUserId !== userId) {
    const caller = await User.findOne({ username: req.user.username });
    if (!caller || (caller.designation !== "cm" && caller.role !== "manager")) {
      return res.status(403).json({ error: "Not authorized to tick for another user." });
    }
    userId = forUserId;
  }

  const periodKey = todayKey();
  const sortKey = `${taskId}#${periodKey}`;
  const targetUserIds = await getPeerUserIds(userId, location);

  const existing = await Completion.findOne({
    userId,
    taskId_periodKey: sortKey,
  });

  if (existing) {
    for (const uid of targetUserIds) {
      await Completion.deleteOne({
        userId: uid,
        taskId_periodKey: sortKey,
      });
      broadcast("completion", { userId: uid, taskId, status: "unchecked", periodKey });
    }
    return res.json({ ok: true, status: "unchecked" });
  }

  const completed_at = new Date().toISOString();
  for (const uid of targetUserIds) {
    await Completion.findOneAndUpdate(
      { userId: uid, taskId_periodKey: sortKey },
      {
        userId: uid,
        taskId_periodKey: sortKey,
        taskId,
        periodKey,
        completed_at,
      },
      { upsert: true, returnDocument: 'after' }
    );
    broadcast("completion", { userId: uid, taskId, status: "checked", periodKey, completed_at });
  }

  res.json({ ok: true, status: "checked" });
}

async function clearCompletions(req, res) {
  const userId = req.params.userId || req.user.id;
  const periodKey = req.query.date || todayKey();

  if (userId !== req.user.id && req.user.role !== "manager") {
    return res.status(403).json({ error: "Managers only." });
  }

  const targetUserIds = await getPeerUserIds(userId);
  let totalDeleted = 0;

  for (const uid of targetUserIds) {
    const result = await Completion.deleteMany({ periodKey, userId: uid });
    totalDeleted += result.deletedCount || 0;
  }

  res.json({ ok: true, deleted: totalDeleted });
}

module.exports = { getCompletions, getAllCompletions, toggleTask, clearCompletions };
