const { ScanCommand, QueryCommand, GetCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");
const { broadcast } = require("../ws");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getPeerUserIds(userId) {
  try {
    const { Item: user } = await docClient.send(new GetCommand({
      TableName: Tables.USERS,
      Key: { id: userId },
    }));
    if (!user) return [userId];

    const { Items: peers } = await docClient.send(new ScanCommand({
      TableName: Tables.USERS,
    }));
    const emps = (peers || []).filter(p => p.role === "employee");

    const isCM = user.designation === "cm";
    let team = [user];

    if (isCM) {
      const mySupervisors = emps.filter(
        (e) => e.supervisor_id === user.id || (user.location && user.location !== "All centres" && e.location === user.location)
      );
      team = [user, ...mySupervisors];
    } else if (user.supervisor_id) {
      const myCM = emps.find(
        (e) => e.id === user.supervisor_id || (e.designation === "cm" && e.location === user.location)
      );
      const coSupervisors = emps.filter(
        (e) => (user.location && user.location !== "All centres" && e.location === user.location) || (user.supervisor_id && e.supervisor_id === user.supervisor_id)
      );
      team = [user, ...(myCM ? [myCM] : []), ...coSupervisors];
    } else if (user.location && user.location !== "All centres") {
      team = emps.filter((e) => e.location === user.location);
      if (!team.some((e) => e.id === user.id)) team = [user, ...team];
    }

    const seen = new Set();
    const result = [];
    for (const e of team) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        result.push(e.id);
      }
    }
    return result.length ? result : [userId];
  } catch (err) {
    console.error("Error getting peer user IDs:", err);
    return [userId];
  }
}

async function getCompletions(req, res) {
  const userId = req.params.userId || req.user.id;
  const periodKey = req.query.date || todayKey();

  const { Items } = await docClient.send(new QueryCommand({
    TableName: Tables.COMPLETIONS,
    IndexName: "periodKey-index",
    KeyConditionExpression: "periodKey = :pk AND userId = :uid",
    ExpressionAttributeValues: { ":pk": periodKey, ":uid": userId },
  }));

  const completions = {};
  for (const row of (Items || [])) {
    completions[row.taskId] = row.completed_at;
  }
  res.json(completions);
}

async function getAllCompletions(req, res) {
  const periodKey = req.query.date || todayKey();

  const { Items } = await docClient.send(new QueryCommand({
    TableName: Tables.COMPLETIONS,
    IndexName: "periodKey-index",
    KeyConditionExpression: "periodKey = :pk",
    ExpressionAttributeValues: { ":pk": periodKey },
  }));

  const completions = {};
  for (const row of (Items || [])) {
    if (!completions[row.userId]) completions[row.userId] = {};
    completions[row.userId][row.taskId] = row.completed_at;
  }
  res.json(completions);
}

async function toggleTask(req, res) {
  const { taskId } = req.params;
  const forUserId = req.body?.forUserId;
  let userId = req.user.id;

  if (forUserId && forUserId !== userId) {
    const { Items } = await docClient.send(new QueryCommand({
      TableName: Tables.USERS,
      IndexName: "username-index",
      KeyConditionExpression: "username = :u",
      ExpressionAttributeValues: { ":u": req.user.username },
    }));
    const caller = Items?.[0];
    if (!caller || (caller.designation !== "cm" && caller.role !== "manager")) {
      return res.status(403).json({ error: "Not authorized to tick for another user." });
    }
    userId = forUserId;
  }

  const periodKey = todayKey();
  const sortKey = `${taskId}#${periodKey}`;
  const targetUserIds = await getPeerUserIds(userId);

  const { Item: existing } = await docClient.send(new GetCommand({
    TableName: Tables.COMPLETIONS,
    Key: { userId, taskId_periodKey: sortKey },
  }));

  if (existing) {
    for (const uid of targetUserIds) {
      await docClient.send(new DeleteCommand({
        TableName: Tables.COMPLETIONS,
        Key: { userId: uid, taskId_periodKey: sortKey },
      }));
      broadcast("completion", { userId: uid, taskId, status: "unchecked", periodKey });
    }
    return res.json({ ok: true, status: "unchecked" });
  }

  const completed_at = new Date().toISOString();
  for (const uid of targetUserIds) {
    await docClient.send(new PutCommand({
      TableName: Tables.COMPLETIONS,
      Item: {
        userId: uid,
        taskId_periodKey: sortKey,
        taskId,
        periodKey,
        completed_at,
      },
    }));
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
    const { Items } = await docClient.send(new QueryCommand({
      TableName: Tables.COMPLETIONS,
      IndexName: "periodKey-index",
      KeyConditionExpression: "periodKey = :pk AND userId = :uid",
      ExpressionAttributeValues: { ":pk": periodKey, ":uid": uid },
    }));

    const items = Items || [];
    for (const row of items) {
      await docClient.send(new DeleteCommand({
        TableName: Tables.COMPLETIONS,
        Key: { userId: row.userId, taskId_periodKey: row.taskId_periodKey },
      }));
    }
    totalDeleted += items.length;
  }

  res.json({ ok: true, deleted: totalDeleted });
}

module.exports = { getCompletions, getAllCompletions, toggleTask, clearCompletions };
