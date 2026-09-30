const { Issue, User } = require("../models");

const ISSUE_DELETE_WINDOW_MS = 2 * 60 * 60 * 1000;

async function listIssues(req, res) {
  const issues = await Issue.find({}).sort({ created_at: -1 });
  res.json(issues.map(formatIssue));
}

async function createIssue(req, res) {
  const { location, category, notes, description } = req.body;
  const userId = req.user.id;
  const text = (notes || description || "").trim();
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const emp = await User.findOne({ id: userId });
  const employeeName = emp?.name || "Unknown";

  const id = `i-${Date.now()}`;
  const now = new Date().toISOString();

  const item = await Issue.create({
    id,
    user_id: userId,
    employee_id: userId,
    employee_name: employeeName,
    location: location || "Unknown",
    category: category || "Other",
    notes: text,
    description: text,
    photo_url: photoUrl,
    status: "Unattended",
    notified_email: "operations@onwardworkspaces.com",
    created_at: now,
    updated_at: null,
  });

  res.status(201).json(formatIssue(item));
}

async function updateIssueStatus(req, res) {
  const { issueId } = req.params;
  const { status } = req.body;

  const validStatuses = ["Unattended", "In progress", "Resolved"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const existing = await Issue.findOne({ id: issueId });
  if (!existing) {
    return res.status(404).json({ error: "Issue not found." });
  }

  existing.status = status;
  existing.updated_at = new Date().toISOString();
  if (status === "Resolved") {
    existing.resolved_at = new Date().toISOString();
  }

  await existing.save();
  res.json({ ok: true });
}

async function deleteIssue(req, res) {
  const { issueId } = req.params;

  const item = await Issue.findOne({ id: issueId });
  if (!item) {
    return res.status(404).json({ error: "Issue not found." });
  }

  const created = new Date(item.created_at).getTime();
  if (Date.now() - created >= ISSUE_DELETE_WINDOW_MS) {
    return res.status(400).json({ error: "Issues can only be deleted within 2 hours of reporting." });
  }

  await Issue.deleteOne({ id: issueId });
  res.json({ ok: true });
}

function formatIssue(row) {
  return {
    id: row.id,
    employeeId: row.user_id || row.employee_id,
    employeeName: row.employee_name,
    location: row.location,
    category: row.category,
    notes: row.notes,
    description: row.description || row.notes,
    photo: row.photo_url,
    status: row.status,
    notifiedEmail: row.notified_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { listIssues, createIssue, updateIssueStatus, deleteIssue };
