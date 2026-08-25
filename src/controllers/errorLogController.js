const { ScanCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

async function listErrorLogs(req, res) {
  const { level, limit } = req.query;
  const maxItems = Math.min(Number(limit) || 100, 500);

  let Items;
  if (level && level !== "all") {
    const result = await docClient.send(new QueryCommand({
      TableName: Tables.ERROR_LOGS,
      IndexName: "level-index",
      KeyConditionExpression: "#lvl = :lvl",
      ExpressionAttributeNames: { "#lvl": "level" },
      ExpressionAttributeValues: { ":lvl": level },
      ScanIndexForward: false,
      Limit: maxItems,
    }));
    Items = result.Items;
  } else {
    const result = await docClient.send(new ScanCommand({
      TableName: Tables.ERROR_LOGS,
      Limit: maxItems,
    }));
    Items = (result.Items || []).sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || "")
    );
  }

  res.json(Items || []);
}

async function deleteErrorLog(req, res) {
  const { logId } = req.params;
  await docClient.send(new DeleteCommand({
    TableName: Tables.ERROR_LOGS,
    Key: { id: logId },
  }));
  res.json({ ok: true });
}

module.exports = { listErrorLogs, deleteErrorLog };
