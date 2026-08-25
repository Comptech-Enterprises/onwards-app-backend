const { QueryCommand, GetCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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
  const userId = req.user.id;
  const periodKey = todayKey();
  const sortKey = `${taskId}#${periodKey}`;

  const { Item: existing } = await docClient.send(new GetCommand({
    TableName: Tables.COMPLETIONS,
    Key: { userId, taskId_periodKey: sortKey },
  }));

  if (existing) {
    await docClient.send(new DeleteCommand({
      TableName: Tables.COMPLETIONS,
      Key: { userId, taskId_periodKey: sortKey },
    }));
    return res.json({ ok: true, status: "unchecked" });
  }

  await docClient.send(new PutCommand({
    TableName: Tables.COMPLETIONS,
    Item: {
      userId,
      taskId_periodKey: sortKey,
      taskId,
      periodKey,
      completed_at: new Date().toISOString(),
    },
  }));

  res.json({ ok: true, status: "checked" });
}

async function clearCompletions(req, res) {
  const userId = req.params.userId || req.user.id;
  const periodKey = req.query.date || todayKey();

  if (userId !== req.user.id && req.user.role !== "manager") {
    return res.status(403).json({ error: "Managers only." });
  }

  const { Items } = await docClient.send(new QueryCommand({
    TableName: Tables.COMPLETIONS,
    IndexName: "periodKey-index",
    KeyConditionExpression: "periodKey = :pk AND userId = :uid",
    ExpressionAttributeValues: { ":pk": periodKey, ":uid": userId },
  }));

  const items = Items || [];
  for (const row of items) {
    await docClient.send(new DeleteCommand({
      TableName: Tables.COMPLETIONS,
      Key: { userId: row.userId, taskId_periodKey: row.taskId_periodKey },
    }));
  }

  res.json({ ok: true, deleted: items.length });
}

module.exports = { getCompletions, getAllCompletions, toggleTask, clearCompletions };
