const { QueryCommand, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getReviewChecks(req, res) {
  const periodKey = req.query.date || todayKey();

  const { Items } = await docClient.send(new QueryCommand({
    TableName: Tables.REVIEW_CHECKS,
    KeyConditionExpression: "periodKey = :pk",
    ExpressionAttributeValues: { ":pk": periodKey },
  }));

  const checks = {};
  for (const row of (Items || [])) {
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

  const { Item: existing } = await docClient.send(new GetCommand({
    TableName: Tables.REVIEW_CHECKS,
    Key: { periodKey, cat_loc_task: sortKey },
  }));

  if (existing) {
    return res.status(400).json({ ok: false, error: "Ticked items cannot be unmarked." });
  }

  await docClient.send(new PutCommand({
    TableName: Tables.REVIEW_CHECKS,
    Item: {
      periodKey,
      cat_loc_task: sortKey,
      category,
      location,
      taskId,
      checked_by: userId,
      checked_at: new Date().toISOString(),
    },
  }));

  res.json({ ok: true });
}

module.exports = { getReviewChecks, checkReviewTask };
