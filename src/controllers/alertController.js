const { QueryCommand, PutCommand, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

async function getAlerts(req, res) {
  const userId = req.user.id;

  const [userAlerts, broadcastAlerts] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: Tables.ALERTS,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
      ScanIndexForward: false,
    })),
    docClient.send(new QueryCommand({
      TableName: Tables.ALERTS,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": "BROADCAST" },
      ScanIndexForward: false,
    })),
  ]);

  const all = [...(userAlerts.Items || []), ...(broadcastAlerts.Items || [])];
  all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  res.json(all.slice(0, 80).map(formatAlert));
}

async function createAlert(req, res) {
  const { userId, type, title, body } = req.body;
  const id = `a-${Date.now()}`;

  await docClient.send(new PutCommand({
    TableName: Tables.ALERTS,
    Item: {
      userId: userId || "BROADCAST",
      id,
      type: type || "info",
      title,
      body: body || null,
      is_read: false,
      created_at: new Date().toISOString(),
    },
  }));

  res.status(201).json({ ok: true, id });
}

async function markRead(req, res) {
  const { alertId } = req.params;
  const userId = req.user.id;

  const { Item } = await docClient.send(new GetCommand({
    TableName: Tables.ALERTS,
    Key: { userId, id: alertId },
  }));

  const actualUserId = Item ? userId : "BROADCAST";

  await docClient.send(new UpdateCommand({
    TableName: Tables.ALERTS,
    Key: { userId: actualUserId, id: alertId },
    UpdateExpression: "SET is_read = :val",
    ExpressionAttributeValues: { ":val": true },
  }));

  res.json({ ok: true });
}

async function markAllRead(req, res) {
  const userId = req.user.id;

  const [userAlerts, broadcastAlerts] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: Tables.ALERTS,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
      FilterExpression: "is_read = :f",
    })),
    docClient.send(new QueryCommand({
      TableName: Tables.ALERTS,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": "BROADCAST", ":f": false },
      FilterExpression: "is_read = :f",
    })),
  ]);

  const all = [...(userAlerts.Items || []), ...(broadcastAlerts.Items || [])];
  for (const alert of all) {
    await docClient.send(new UpdateCommand({
      TableName: Tables.ALERTS,
      Key: { userId: alert.userId, id: alert.id },
      UpdateExpression: "SET is_read = :val",
      ExpressionAttributeValues: { ":val": true },
    }));
  }

  res.json({ ok: true });
}

function formatAlert(row) {
  return {
    id: row.id,
    userId: row.userId === "BROADCAST" ? null : row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    read: !!row.is_read,
    createdAt: row.created_at,
  };
}

module.exports = { getAlerts, createAlert, markRead, markAllRead };
