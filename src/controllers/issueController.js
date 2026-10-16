const { Issue, User, Alert } = require("../models");
const { uploadToR2 } = require("../config/r2");
const { broadcast } = require("../ws");
const { resolveUserHierarchy } = require("../services/hierarchyService");

const ISSUE_DELETE_WINDOW_MS = 2 * 60 * 60 * 1000;

function formatIssue(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || row.employee_id,
    employeeId: row.user_id || row.employee_id,
    employeeName: row.employee_name,
    location: row.location,
    category: row.category,
    notes: row.notes,
    description: row.description || row.notes,
    photo: row.photo_url,
    photoUrl: row.photo_url,
    status: row.status,

    // Hierarchy
    cmId: row.cm_id,
    cmName: row.cm_name,
    clusterManagerId: row.cluster_manager_id,
    clusterManagerName: row.cluster_manager_name,

    // Progress updates
    progressNote: row.progress_note || null,
    progressUpdatedBy: row.progress_updated_by || null,
    progressUpdatedByRole: row.progress_updated_by_role || null,
    progressUpdatedAt: row.progress_updated_at || null,
    progressHistory: (row.progress_history || []).map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      updatedById: h.updated_by_id,
      updatedByName: h.updated_by_name,
      updatedByRole: h.updated_by_role,
      updatedAt: h.updated_at,
    })),

    // Escalation details
    escalationSent: !!row.escalation_sent,
    escalatedAt: row.escalated_at || null,
    escalatedTo: row.escalated_to || [],

    notifiedEmail: row.notified_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

async function listIssues(req, res) {
  const issues = await Issue.find({}).sort({ created_at: -1 });
  res.json(issues.map(formatIssue));
}

async function createIssue(req, res) {
  const { location, category, notes, description } = req.body;
  const userId = req.user.id;
  const text = (notes || description || "").trim();

  // Mandatory photo validation
  if (!req.file) {
    return res.status(400).json({ error: "A photo is required showing the issue." });
  }

  // Upload photo to Cloudflare R2 under 'issues'
  let photoUrl = null;
  try {
    photoUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype, "issues");
  } catch (err) {
    console.error("[ISSUE PHOTO ERROR] Failed to upload to R2:", err.message);
    return res.status(500).json({ error: "Failed to upload issue photo. Please try again." });
  }

  // Resolve hierarchy (CM and Cluster Manager)
  const hierarchy = await resolveUserHierarchy(userId, { location });
  const employeeName = hierarchy.employeeName || req.user.name || "Unknown";

  const id = `i-${Date.now()}`;
  const now = new Date().toISOString();

  const initialRole = hierarchy.designation === "cm"
    ? "Centre Manager"
    : req.user.role === "manager"
    ? "Manager"
    : "Supervisor";

  const item = await Issue.create({
    id,
    user_id: userId,
    employee_id: userId,
    employee_name: employeeName,
    location: location || hierarchy.location || "Unknown",
    category: category || "Other",
    notes: text,
    description: text,
    photo_url: photoUrl,
    status: "Unattended",

    cm_id: hierarchy.cmId || (hierarchy.designation === "cm" ? userId : null),
    cm_name: hierarchy.cmName || (hierarchy.designation === "cm" ? employeeName : null),
    cluster_manager_id: hierarchy.clusterManagerId || null,
    cluster_manager_name: hierarchy.clusterManagerName || null,

    progress_note: null,
    progress_updated_by: null,
    progress_updated_by_role: null,
    progress_updated_at: null,
    progress_history: [
      {
        id: `prog-${Date.now()}`,
        status: "Unattended",
        note: `Issue reported by ${employeeName} with photo proof.`,
        updated_by_id: userId,
        updated_by_name: employeeName,
        updated_by_role: initialRole,
        updated_at: now,
      },
    ],

    escalation_sent: false,
    escalated_at: null,
    escalated_to: [],

    notified_email: "operations@onwardworkspaces.com",
    created_at: now,
    updated_at: null,
  });

  const formatted = formatIssue(item);

  // Notify Cluster Manager in-app & via WebSocket
  if (hierarchy.clusterManagerId) {
    const alertId = `a-iss-${Date.now()}`;
    const alertTitle = `🚨 New Issue: ${category} at ${location || hierarchy.location}`;
    const alertBody = `${employeeName} reported: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`;

    try {
      await Alert.create({
        id: alertId,
        userId: hierarchy.clusterManagerId,
        type: "issue",
        title: alertTitle,
        body: alertBody,
        message: alertBody,
        is_read: false,
        created_at: now,
      });

      broadcast("alert_created", {
        id: alertId,
        userId: hierarchy.clusterManagerId,
        type: "issue",
        title: alertTitle,
        body: alertBody,
        createdAt: now,
      });
    } catch (err) {
      console.error("[ALERT ERROR] Failed to notify Cluster Manager:", err.message);
    }
  }

  // Broadcast real-time issue creation
  broadcast("issue_created", formatted);

  res.status(201).json(formatted);
}

/**
 * Updates issue progress note and status (supported for Cluster Managers, Managers, and CMs)
 */
async function updateIssueProgress(req, res) {
  const { issueId } = req.params;
  const { status, progressNote } = req.body;
  const updater = req.user;

  const validStatuses = ["Unattended", "In progress", "Resolved"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const existing = await Issue.findOne({ id: issueId });
  if (!existing) {
    return res.status(404).json({ error: "Issue not found." });
  }

  const newStatus = status || existing.status;
  const cleanNote = (progressNote || "").trim();
  const now = new Date().toISOString();

  const updaterRole =
    updater.designation === "cluster-manager"
      ? "Cluster Manager"
      : updater.designation === "cm"
      ? "Centre Manager"
      : updater.role === "manager"
      ? "Manager"
      : "Supervisor";

  if (cleanNote || status) {
    if (cleanNote) {
      existing.progress_note = cleanNote;
      existing.progress_updated_by = updater.name;
      existing.progress_updated_by_role = updaterRole;
      existing.progress_updated_at = now;
    }

    existing.progress_history.push({
      id: `prog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: newStatus,
      note: cleanNote || `Status updated to ${newStatus}`,
      updated_by_id: updater.id,
      updated_by_name: updater.name,
      updated_by_role: updaterRole,
      updated_at: now,
    });
  }

  existing.status = newStatus;
  existing.updated_at = now;
  if (newStatus === "Resolved") {
    existing.resolved_at = now;
  }

  await existing.save();
  const formatted = formatIssue(existing);

  // Notify the counterpart (if updated by CM, notify Cluster Manager; if updated by Cluster Manager, notify CM)
  const recipientUserId =
    updater.id === existing.user_id ? existing.cluster_manager_id : existing.user_id;

  if (recipientUserId && recipientUserId !== updater.id) {
    const alertId = `a-prog-${Date.now()}`;
    const alertTitle = `Issue Progress: ${existing.category} (${newStatus})`;
    const alertBody = cleanNote
      ? `${updater.name} (${updaterRole}): "${cleanNote.slice(0, 100)}"`
      : `${updater.name} (${updaterRole}) changed status to ${newStatus}`;

    try {
      await Alert.create({
        id: alertId,
        userId: recipientUserId,
        type: "issue_update",
        title: alertTitle,
        body: alertBody,
        message: alertBody,
        is_read: false,
        created_at: now,
      });

      broadcast("alert_created", {
        id: alertId,
        userId: recipientUserId,
        type: "issue_update",
        title: alertTitle,
        body: alertBody,
        createdAt: now,
      });
    } catch (err) {
      console.error("[ALERT ERROR] Failed to send progress alert:", err.message);
    }
  }

  // Broadcast real-time issue update to all connected clients
  broadcast("issue_updated", formatted);

  res.json({ ok: true, issue: formatted });
}

async function updateIssueStatus(req, res) {
  return updateIssueProgress(req, res);
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
  broadcast("issue_deleted", { id: issueId });

  res.json({ ok: true });
}

module.exports = {
  listIssues,
  createIssue,
  updateIssueProgress,
  updateIssueStatus,
  deleteIssue,
  formatIssue,
};
