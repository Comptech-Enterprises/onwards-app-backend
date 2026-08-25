const { ScanCommand, GetCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

const ISSUE_DELETE_WINDOW_MS = 2 * 60 * 60 * 1000;

async function listIssues(req, res) {
  const { Items } = await docClient.send(new ScanCommand({ TableName: Tables.ISSUES }));
  const sorted = (Items || []).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  res.json(sorted.map(formatIssue));
}

async function createIssue(req, res) {
  const { location, category, notes, description } = req.body;
  const userId = req.user.id;
  const text = (notes || description || "").trim();
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const { Item: emp } = await docClient.send(new GetCommand({
    TableName: Tables.USERS,
    Key: { id: userId },
  }));
  const employeeName = emp?.name || "Unknown";

  const id = `i-${Date.now()}`;
  const item = {
    id,
    user_id: userId,
    employee_name: employeeName,
    location: location || "Unknown",
    category: category || "Other",
    notes: text,
    photo_url: photoUrl,
    status: "Unattended",
    notified_email: "operations@onwardworkspaces.com",
    created_at: new Date().toISOString(),
    updated_at: null,
  };

  await docClient.send(new PutCommand({
    TableName: Tables.ISSUES,
    Item: item,
  }));

  res.status(201).json(formatIssue(item));
}

async function updateIssueStatus(req, res) {
  const { issueId } = req.params;
  const { status } = req.body;

  const validStatuses = ["Unattended", "In progress", "Resolved"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const { Item: existing } = await docClient.send(new GetCommand({
    TableName: Tables.ISSUES,
    Key: { id: issueId },
  }));

  if (!existing) {
    return res.status(404).json({ error: "Issue not found." });
  }

  existing.status = status;
  existing.updated_at = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: Tables.ISSUES,
    Item: existing,
  }));

  res.json({ ok: true });
}

async function deleteIssue(req, res) {
  const { issueId } = req.params;

  const { Item } = await docClient.send(new GetCommand({
    TableName: Tables.ISSUES,
    Key: { id: issueId },
  }));

  if (!Item) {
    return res.status(404).json({ error: "Issue not found." });
  }

  const created = new Date(Item.created_at).getTime();
  if (Date.now() - created >= ISSUE_DELETE_WINDOW_MS) {
    return res.status(400).json({ error: "Issues can only be deleted within 2 hours of reporting." });
  }

  await docClient.send(new DeleteCommand({
    TableName: Tables.ISSUES,
    Key: { id: issueId },
  }));

  res.json({ ok: true });
}

function formatIssue(row) {
  return {
    id: row.id,
    employeeId: row.user_id,
    employeeName: row.employee_name,
    location: row.location,
    category: row.category,
    notes: row.notes,
    description: row.notes,
    photo: row.photo_url,
    status: row.status,
    notifiedEmail: row.notified_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { listIssues, createIssue, updateIssueStatus, deleteIssue };
