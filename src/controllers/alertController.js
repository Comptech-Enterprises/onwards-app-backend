const { Alert } = require("../models");

async function getAlerts(req, res) {
  const userId = req.user.id;

  const all = await Alert.find({
    userId: { $in: [userId, "BROADCAST"] },
  })
    .sort({ created_at: -1 })
    .limit(80);

  res.json(all.map(formatAlert));
}

async function createAlert(req, res) {
  const { userId, type, title, body } = req.body;
  const id = `a-${Date.now()}`;

  await Alert.create({
    id,
    userId: userId || "BROADCAST",
    type: type || "info",
    title,
    body: body || null,
    is_read: false,
    created_at: new Date().toISOString(),
  });

  res.status(201).json({ ok: true, id });
}

async function markRead(req, res) {
  const { alertId } = req.params;
  const userId = req.user.id;

  await Alert.updateOne(
    { id: alertId, userId: { $in: [userId, "BROADCAST"] } },
    { is_read: true }
  );

  res.json({ ok: true });
}

async function markAllRead(req, res) {
  const userId = req.user.id;

  await Alert.updateMany(
    { userId: { $in: [userId, "BROADCAST"] }, is_read: false },
    { is_read: true }
  );

  res.json({ ok: true });
}

function formatAlert(row) {
  return {
    id: row.id,
    userId: row.userId === "BROADCAST" ? null : row.userId,
    type: row.type,
    title: row.title,
    body: row.body || row.message,
    read: !!row.is_read,
    createdAt: row.created_at,
  };
}

module.exports = { getAlerts, createAlert, markRead, markAllRead };
