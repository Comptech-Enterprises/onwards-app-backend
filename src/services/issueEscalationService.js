const { Issue, User, Alert } = require("../models");
const { sendMail } = require("./mailService");
const { broadcast } = require("../ws");

const ESCALATION_RECIPIENTS = [
  "vineeta@onwardworkspaces.com",
  "mannat@onwardworkspaces.com",
];

const ESCALATION_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 Days in milliseconds

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds the professional HTML escalation email
 */
function buildEscalationEmailHtml({ issue, daysOpen, hoursOpen }) {
  const photoSection = issue.photo_url
    ? `
      <div style="margin: 20px 0; padding: 16px; background: #FFF5F0; border: 1px solid #FFD1B3; border-radius: 8px;">
        <p style="margin: 0 0 10px 0; font-weight: 700; color: #C53030; font-size: 13px;">📸 ISSUE PHOTO PROOF ATTACHED</p>
        <a href="${issue.photo_url}" target="_blank" style="display: inline-block;">
          <img src="${issue.photo_url}" alt="Issue photo" style="max-width: 100%; max-height: 340px; border-radius: 6px; border: 1px solid #E2E8F0; object-fit: cover;" />
        </a>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #718096;">
          <a href="${issue.photo_url}" target="_blank" style="color: #FF5A00; text-decoration: underline; font-weight: 600;">Click to view full high-resolution image</a>
        </p>
      </div>
    `
    : `<p style="color: #A0AEC0; font-style: italic; font-size: 13px;">No photo attached.</p>`;

  const progressHistoryRows = (issue.progress_history || []).length > 0
    ? issue.progress_history
        .map((p, idx) => `
          <div style="padding: 10px 12px; background: ${idx % 2 === 0 ? "#F7FAFC" : "#FFFFFF"}; border-left: 3px solid #3182CE; margin-bottom: 8px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #4A5568; margin-bottom: 4px;">
              <strong>${escapeHtml(p.updated_by_name || "Manager")} (${escapeHtml(p.updated_by_role || "Management")})</strong>
              <span style="color: #718096;">${new Date(p.updated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
            </div>
            <div style="font-size: 13px; color: #2D3748;">
              <span style="display: inline-block; padding: 2px 6px; font-size: 11px; font-weight: 700; border-radius: 4px; background: ${p.status === "In progress" ? "#FEFCBF; color: #B7791F" : "#E2E8F0; color: #4A5568"}; margin-right: 6px;">
                ${escapeHtml(p.status)}
              </span>
              ${escapeHtml(p.note || "Status updated")}
            </div>
          </div>
        `)
        .join("")
    : `<p style="color: #A0AEC0; font-style: italic; font-size: 13px; margin: 6px 0;">No intermediate progress updates were logged.</p>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Issue Escalation: ${escapeHtml(issue.category)} at ${escapeHtml(issue.location)}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.5; max-width: 680px; margin: 0 auto; padding: 24px; background: #ffffff;">
      
      <!-- Header -->
      <div style="border-bottom: 2px solid #E53E3E; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h1 style="color: #FF5A00; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">ONWARD WORKSPACES</h1>
          <span style="background: #FFF5F5; color: #E53E3E; padding: 5px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; border: 1px solid #FEB2B2; text-transform: uppercase;">
            🚨 3-Day Escalation Alert
          </span>
        </div>
        <h2 style="color: #2D3748; margin: 14px 0 4px 0; font-size: 18px; font-weight: 700;">
          Unresolved Issue at ${escapeHtml(issue.location)}
        </h2>
        <p style="color: #718096; margin: 0; font-size: 13px;">
          This issue was reported <strong>${daysOpen} days ago (${hoursOpen} hours)</strong> and has not been marked as Resolved.
        </p>
      </div>

      <!-- Alert Banner -->
      <div style="background: #FFF5F5; border: 1px solid #FEB2B2; border-left: 4px solid #E53E3E; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; color: #9B2C2C; font-weight: 600;">
          Attention Vineeta Sanduja &amp; Mannat Jain:
        </p>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #C53030;">
          Per standard operational policy, any centre issue exceeding 72 hours without resolution is automatically escalated to executive leadership for review and intervention.
        </p>
      </div>

      <!-- Issue Overview Card -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; background: #F7FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #4A5568; width: 35%;">Category:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #2D3748;">${escapeHtml(issue.category)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #4A5568;">Centre Location:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; color: #2D3748;">${escapeHtml(issue.location)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #4A5568;">Reported By (CM):</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; color: #2D3748;">${escapeHtml(issue.employee_name || "Unknown")}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #4A5568;">Assigned Cluster Manager:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; color: #2D3748; font-weight: 600;">${escapeHtml(issue.cluster_manager_name || "Unassigned")}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #4A5568;">Date Reported:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; color: #2D3748;">${new Date(issue.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #4A5568;">Current Status:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; background: ${issue.status === "In progress" ? "#FEFCBF; color: #B7791F" : "#FED7D7; color: #9B2C2C"};">
              ${escapeHtml(issue.status)}
            </span>
          </td>
        </tr>
      </table>

      <!-- Issue Description -->
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #2D3748; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
          Problem Description
        </h3>
        <div style="background: #EDF2F7; padding: 14px 16px; border-radius: 6px; font-size: 14px; color: #2D3748; border-left: 4px solid #718096; white-space: pre-wrap;">${escapeHtml(issue.notes || issue.description || "No description provided.")}</div>
      </div>

      <!-- Photo Proof -->
      ${photoSection}

      <!-- Progress Updates & Remarks -->
      <div style="margin-top: 24px;">
        <h3 style="font-size: 14px; font-weight: 700; color: #2D3748; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">
          Progress Updates Logged
        </h3>
        ${progressHistoryRows}
      </div>

      <!-- Footer -->
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #A0AEC0; text-align: center;">
        <p style="margin: 0;">Automated 72-Hour Quality &amp; Operations Escalation • Onward Workspaces</p>
        <p style="margin: 4px 0 0 0;">Recipients: Vineeta Sanduja &lt;vineeta@onwardworkspaces.com&gt;, Mannat Jain &lt;mannat@onwardworkspaces.com&gt;</p>
      </div>

    </body>
    </html>
  `;
}

/**
 * Checks all open/unresolved issues and escalates any issue that is >= 3 days old
 */
async function checkAndEscalateOverdueIssues() {
  const now = Date.now();
  const threeDaysAgoIso = new Date(now - ESCALATION_THRESHOLD_MS).toISOString();

  // Find unresolved issues older than 3 days that have not yet been escalated
  const overdueIssues = await Issue.find({
    status: { $ne: "Resolved" },
    escalation_sent: { $ne: true },
    created_at: { $lte: threeDaysAgoIso },
  });

  if (overdueIssues.length === 0) {
    return { count: 0 };
  }

  console.log(`[ESCALATION] Found ${overdueIssues.length} unresolved issue(s) exceeding 3 days.`);

  let escalatedCount = 0;

  for (const issue of overdueIssues) {
    try {
      const createdTime = new Date(issue.created_at).getTime();
      const diffMs = now - createdTime;
      const hoursOpen = Math.round(diffMs / (1000 * 60 * 60));
      const daysOpen = Math.floor(hoursOpen / 24);

      const html = buildEscalationEmailHtml({ issue, daysOpen, hoursOpen });
      const subject = `[URGENT ESCALATION] Unresolved Issue (3+ Days): ${issue.category} at ${issue.location}`;

      // Send email to Vineeta and Mannat
      await sendMail({
        to: ESCALATION_RECIPIENTS,
        subject,
        html,
      });

      // Update issue model
      issue.escalation_sent = true;
      issue.escalated_at = new Date().toISOString();
      issue.escalated_to = ESCALATION_RECIPIENTS;
      await issue.save();

      // Create in-app alerts for relevant stakeholders
      const alertId = `a-esc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const alertTitle = `⚠️ Issue Escalated to Senior Mgmt (3+ Days Open)`;
      const alertBody = `Issue "${issue.category}" at ${issue.location} was escalated to Vineeta & Mannat.`;

      // Alert Vineeta ('m4'), Mannat ('m2'), Cluster Manager, and CM
      const userIdsToAlert = new Set();
      if (issue.cluster_manager_id) userIdsToAlert.add(issue.cluster_manager_id);
      if (issue.user_id) userIdsToAlert.add(issue.user_id);
      userIdsToAlert.add("m4"); // Vineeta
      userIdsToAlert.add("m2"); // Mannat

      for (const uid of userIdsToAlert) {
        await Alert.create({
          id: `${alertId}-${uid}`,
          userId: uid,
          type: "issue_escalation",
          title: alertTitle,
          body: alertBody,
          message: alertBody,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      broadcast("alert_created", {
        type: "issue_escalation",
        title: alertTitle,
        body: alertBody,
        issueId: issue.id,
      });

      broadcast("issue_updated", {
        id: issue.id,
        escalationSent: true,
        escalatedAt: issue.escalated_at,
      });

      escalatedCount++;
      console.log(`[ESCALATION] Successfully escalated issue ${issue.id} to Vineeta and Mannat.`);
    } catch (err) {
      console.error(`[ESCALATION ERROR] Failed to escalate issue ${issue.id}:`, err.message);
    }
  }

  return { count: escalatedCount };
}

module.exports = {
  checkAndEscalateOverdueIssues,
  ESCALATION_RECIPIENTS,
};
