const { ScanCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");
const { deleteFromR2 } = require("../config/r2");
const { sendMail, REPORT_RECIPIENTS } = require("./mailService");

function todayKey(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getEmailStyles() {
  return `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
    max-width: 680px;
    margin: 0 auto;
    padding: 24px;
    background: #ffffff;
  `;
}

function getHeaderHtml(title, subtitle, badgeText) {
  return `
    <div style="border-bottom: 2px solid #FF5A00; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1 style="color: #FF5A00; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">ONWARD WORKSPACES</h1>
        ${badgeText ? `<span style="background: #FFF0E6; color: #FF5A00; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; border: 1px solid #FFD1B3;">${escapeHtml(badgeText)}</span>` : ""}
      </div>
      <h2 style="color: #2D3748; margin: 12px 0 4px 0; font-size: 18px; font-weight: 700;">${escapeHtml(title)}</h2>
      <p style="color: #718096; margin: 0; font-size: 13px;">${escapeHtml(subtitle)}</p>
    </div>
  `;
}

function getFooterHtml() {
  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #A0AEC0; text-align: center;">
      <p style="margin: 0;">Automated Operations & Quality Audit Report • Onward Workspaces</p>
      <p style="margin: 4px 0 0 0;">This email was automatically generated and sent to designated management stakeholders.</p>
    </div>
  `;
}

// -------------------------------------------------------------
// 1. DAILY REPORT (Ravi Pawar & Abhishek Gupta)
// -------------------------------------------------------------
async function generateAndSendDailyReport(targetDate = todayKey(), customRecipients = null) {
  const { Items: users } = await docClient.send(new ScanCommand({ TableName: Tables.USERS }));
  const employees = (users || []).filter((u) => u.role === "employee");
  const cmList = employees.filter((u) => u.designation === "cm");

  const { Items: completions } = await docClient.send(new QueryCommand({
    TableName: Tables.COMPLETIONS,
    IndexName: "periodKey-index",
    KeyConditionExpression: "periodKey = :pk",
    ExpressionAttributeValues: { ":pk": targetDate },
  }));

  const compMap = {};
  for (const c of (completions || [])) {
    if (!compMap[c.userId]) compMap[c.userId] = {};
    compMap[c.userId][c.taskId] = c.completed_at;
  }

  // Calculate CM & Group Scores
  const cmReport = cmList.map((cm) => {
    const supervisors = employees.filter((e) => e.supervisor_id === cm.id);
    const groups = {};

    if (supervisors.length === 0) {
      groups[cm.location || "Direct Centre"] = [cm];
    } else {
      supervisors.forEach((s) => {
        const loc = s.location || cm.location || "Direct Centre";
        if (!groups[loc]) groups[loc] = [];
        groups[loc].push(s);
      });
      if (cm.location && cm.location !== "All centres" && !groups[cm.location]) {
        groups[cm.location] = [];
      }
    }

    const groupStats = Object.entries(groups).map(([loc, emps]) => {
      const team = emps.length > 0 ? emps : [cm];
      const doneTaskIds = new Set();
      team.forEach((emp) => {
        Object.keys(compMap[emp.id] || {}).forEach((t) => doneTaskIds.add(t));
      });
      const done = doneTaskIds.size;
      const total = 97;
      const pct = Math.round((done / total) * 100);
      return { loc, emps: emps.length > 0 ? emps.map((e) => e.name).join(", ") : cm.name, done, total, pct };
    });

    const totalGroupPct = groupStats.reduce((sum, g) => sum + g.pct, 0);
    const avgScore = groupStats.length > 0
      ? Math.round(totalGroupPct / groupStats.length)
      : 0;

    return {
      cm,
      groups: groupStats,
      avgScore,
      totalDone,
      totalTasks,
    };
  });

  cmReport.sort((a, b) => b.avgScore - a.avgScore);

  const totalCentres = cmReport.length;
  const overallAvg = totalCentres > 0
    ? Math.round(cmReport.reduce((sum, r) => sum + r.avgScore, 0) / totalCentres)
    : 0;

  // Build HTML Table
  let tableRows = "";
  for (const r of cmReport) {
    const groupBadges = r.groups.map((g) => `
      <div style="margin-bottom: 4px; font-size: 12px;">
        <strong>${escapeHtml(g.loc)}</strong> (${escapeHtml(g.emps)}): 
        <span style="color: ${g.pct >= 80 ? '#2E7D32' : g.pct >= 50 ? '#E65100' : '#C62828'}; font-weight: 700;">
          ${g.done}/${g.total} (${g.pct}%)
        </span>
      </div>
    `).join("");

    const scoreColor = r.avgScore >= 80 ? "#2E7D32" : r.avgScore >= 50 ? "#E65100" : "#C62828";

    tableRows += `
      <tr style="border-bottom: 1px solid #EDF2F7;">
        <td style="padding: 12px; font-weight: 700; color: #2D3748;">
          ${escapeHtml(r.cm.name)}
          <div style="font-size: 11px; font-weight: 400; color: #718096;">Manager: ${r.cm.manager_id === "m-ravi" ? "Ravi Pawar" : "Abhishek Gupta"}</div>
        </td>
        <td style="padding: 12px;">${groupBadges}</td>
        <td style="padding: 12px; text-align: center; font-size: 16px; font-weight: 800; color: ${scoreColor};">
          ${r.avgScore}%
        </td>
        <td style="padding: 12px; text-align: center;">
          <span style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ${r.avgScore >= 80 ? '#E8F5E9; color: #2E7D32;' : '#FFEBEE; color: #C62828;'}">
            ${r.avgScore >= 80 ? "ON TRACK" : "NEEDS ACTION"}
          </span>
        </td>
      </tr>
    `;
  }

  const html = `
    <div style="${getEmailStyles()}">
      ${getHeaderHtml("Daily Centre Task Summary", `Operations & Checklist Status for ${targetDate}`, "DAILY REPORT")}
      
      <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Overall Average</div>
          <div style="font-size: 22px; font-weight: 800; color: #FF5A00; margin-top: 4px;">${overallAvg}%</div>
        </div>
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Total CM Clusters</div>
          <div style="font-size: 22px; font-weight: 800; color: #2D3748; margin-top: 4px;">${totalCentres}</div>
        </div>
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Total Completions</div>
          <div style="font-size: 22px; font-weight: 800; color: #2E7D32; margin-top: 4px;">${(completions || []).length}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background: #EDF2F7; color: #4A5568; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
            <th style="padding: 10px 12px;">Community Manager</th>
            <th style="padding: 10px 12px;">Centres & Ground Staff</th>
            <th style="padding: 10px 12px; text-align: center;">CM Avg</th>
            <th style="padding: 10px 12px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="4" style="padding: 16px; text-align: center;">No data available for today.</td></tr>'}
        </tbody>
      </table>

      ${getFooterHtml()}
    </div>
  `;

  const recipients = customRecipients || REPORT_RECIPIENTS.daily;
  return await sendMail({
    to: recipients,
    subject: `Daily Operations Summary — ${targetDate} (${overallAvg}% Average)`,
    html,
  });
}

// -------------------------------------------------------------
// 2. WEEKLY REPORT (Mannat Jain & Vineeta Sanduja)
// -------------------------------------------------------------
async function generateAndSendWeeklyReport(startDate = todayKey(-7), endDate = todayKey(), customRecipients = null) {
  const { Items: users } = await docClient.send(new ScanCommand({ TableName: Tables.USERS }));
  const employees = (users || []).filter((u) => u.role === "employee");
  const cmList = employees.filter((u) => u.designation === "cm");

  const { Items: completions } = await docClient.send(new ScanCommand({
    TableName: Tables.COMPLETIONS,
    FilterExpression: "periodKey BETWEEN :start AND :end",
    ExpressionAttributeValues: { ":start": startDate, ":end": endDate },
  }));

  const { Items: issues } = await docClient.send(new ScanCommand({ TableName: Tables.ISSUES }));
  const { Items: visitors } = await docClient.send(new ScanCommand({ TableName: Tables.VISITORS }));

  const periodIssues = (issues || []).filter((i) => i.createdAt >= startDate && i.createdAt <= `${endDate}T23:59:59`);
  const periodVisitors = (visitors || []).filter((v) => v.date >= startDate && v.date <= endDate);

  const doneMap = {};
  for (const c of (completions || [])) {
    doneMap[c.userId] = (doneMap[c.userId] || 0) + 1;
  }

  // Calculate 7-day average metrics
  const cmScores = cmList.map((cm) => {
    const supervisors = employees.filter((e) => e.supervisor_id === cm.id);
    const team = supervisors.length > 0 ? supervisors : [cm];
    const totalDone = team.reduce((sum, e) => sum + (doneMap[e.id] || 0), 0);
    const expected = team.length * 97 * 7;
    const weeklyPct = expected > 0 ? Math.min(100, Math.round((totalDone / expected) * 100)) : 0;
    return {
      name: cm.name,
      location: cm.location,
      supervisors: team.map((e) => e.name).join(", "),
      totalDone,
      weeklyPct,
    };
  });

  cmScores.sort((a, b) => b.weeklyPct - a.weeklyPct);
  const avgWeekly = cmScores.length > 0 ? Math.round(cmScores.reduce((s, c) => s + c.weeklyPct, 0) / cmScores.length) : 0;

  let tableRows = cmScores.map((c) => `
    <tr style="border-bottom: 1px solid #EDF2F7;">
      <td style="padding: 10px 12px; font-weight: 700; color: #2D3748;">${escapeHtml(c.name)}</td>
      <td style="padding: 10px 12px; color: #4A5568;">${escapeHtml(c.location)}</td>
      <td style="padding: 10px 12px; color: #718096; font-size: 12px;">${escapeHtml(c.supervisors)}</td>
      <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: ${c.weeklyPct >= 80 ? '#2E7D32' : '#FF5A00'};">
        ${c.weeklyPct}%
      </td>
    </tr>
  `).join("");

  const html = `
    <div style="${getEmailStyles()}">
      ${getHeaderHtml("Weekly Executive Operations Review", `Performance Overview (${startDate} to ${endDate})`, "WEEKLY REPORT")}

      <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Weekly Audit Avg</div>
          <div style="font-size: 22px; font-weight: 800; color: #FF5A00; margin-top: 4px;">${avgWeekly}%</div>
        </div>
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Total Visitors Logged</div>
          <div style="font-size: 22px; font-weight: 800; color: #2D3748; margin-top: 4px;">${periodVisitors.length}</div>
        </div>
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Issues Reported</div>
          <div style="font-size: 22px; font-weight: 800; color: #C62828; margin-top: 4px;">${periodIssues.length}</div>
        </div>
      </div>

      <h3 style="color: #2D3748; font-size: 14px; margin-bottom: 8px;">Centre Performance Ranking</h3>
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background: #EDF2F7; color: #4A5568; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px 12px;">CM</th>
            <th style="padding: 8px 12px;">Centre Location</th>
            <th style="padding: 8px 12px;">Supervisors</th>
            <th style="padding: 8px 12px; text-align: center;">7-Day Score</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      ${getFooterHtml()}
    </div>
  `;

  const recipients = customRecipients || REPORT_RECIPIENTS.weekly;
  return await sendMail({
    to: recipients,
    subject: `Weekly Operations Performance Report (${startDate} - ${endDate})`,
    html,
  });
}

// -------------------------------------------------------------
// 3. MONTHLY REPORT (Ravi, Abhishek, Vineeta & Mannat)
// -------------------------------------------------------------
async function generateAndSendMonthlyReport(year = new Date().getFullYear(), month = new Date().getMonth() + 1, customRecipients = null) {
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}`;

  const { Items: users } = await docClient.send(new ScanCommand({ TableName: Tables.USERS }));
  const employees = (users || []).filter((u) => u.role === "employee");
  const cmList = employees.filter((u) => u.designation === "cm");

  const { Items: completions } = await docClient.send(new ScanCommand({
    TableName: Tables.COMPLETIONS,
    FilterExpression: "begins_with(periodKey, :pref)",
    ExpressionAttributeValues: { ":pref": prefix },
  }));

  const { Items: photos } = await docClient.send(new ScanCommand({
    TableName: Tables.CHECKLIST_PHOTOS,
    FilterExpression: "begins_with(periodKey, :pref)",
    ExpressionAttributeValues: { ":pref": prefix },
  }));

  const monthName = new Date(year, month - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });

  const doneMap = {};
  for (const c of (completions || [])) {
    doneMap[c.userId] = (doneMap[c.userId] || 0) + 1;
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const cmRows = cmList.map((cm) => {
    const supervisors = employees.filter((e) => e.supervisor_id === cm.id);
    const team = supervisors.length > 0 ? supervisors : [cm];
    const totalDone = team.reduce((sum, e) => sum + (doneMap[e.id] || 0), 0);
    const expected = team.length * 97 * daysInMonth;
    const score = expected > 0 ? Math.min(100, Math.round((totalDone / expected) * 100)) : 0;
    return {
      name: cm.name,
      location: cm.location,
      supervisors: team.map((e) => e.name).join(", "),
      score,
      totalDone,
    };
  });

  cmRows.sort((a, b) => b.score - a.score);
  const monthAvg = cmRows.length > 0 ? Math.round(cmRows.reduce((s, c) => s + c.score, 0) / cmRows.length) : 0;

  let tableRows = cmRows.map((r) => `
    <tr style="border-bottom: 1px solid #EDF2F7;">
      <td style="padding: 10px 12px; font-weight: 700; color: #2D3748;">${escapeHtml(r.name)}</td>
      <td style="padding: 10px 12px; color: #4A5568;">${escapeHtml(r.location)}</td>
      <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: ${r.score >= 80 ? '#2E7D32' : '#FF5A00'};">
        ${r.score}%
      </td>
      <td style="padding: 10px 12px; text-align: center; color: #718096; font-size: 12px;">${r.totalDone}</td>
    </tr>
  `).join("");

  const html = `
    <div style="${getEmailStyles()}">
      ${getHeaderHtml(`Monthly Audit & Operations Report`, `Comprehensive Performance Summary for ${monthName}`, "MONTHLY REPORT")}

      <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Monthly Compliance Avg</div>
          <div style="font-size: 22px; font-weight: 800; color: #FF5A00; margin-top: 4px;">${monthAvg}%</div>
        </div>
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Total Tasks Executed</div>
          <div style="font-size: 22px; font-weight: 800; color: #2E7D32; margin-top: 4px;">${(completions || []).length}</div>
        </div>
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Audit Photos Logged</div>
          <div style="font-size: 22px; font-weight: 800; color: #2D3748; margin-top: 4px;">${(photos || []).length}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background: #EDF2F7; color: #4A5568; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px 12px;">CM</th>
            <th style="padding: 8px 12px;">Centre Location</th>
            <th style="padding: 8px 12px; text-align: center;">Monthly Score</th>
            <th style="padding: 8px 12px; text-align: center;">Completed Tasks</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div style="margin-top: 20px; padding: 12px; background: #FFF9F5; border: 1px solid #FFE4D6; border-radius: 6px; font-size: 12px; color: #A04A00;">
        <strong>Retention Policy Notice:</strong> Audit photos for ${monthName} have been processed. In accordance with policy, image storage will now be cleaned up to optimize Cloudflare storage, while task completion data remains preserved for quarterly reporting.
      </div>

      ${getFooterHtml()}
    </div>
  `;

  const recipients = customRecipients || REPORT_RECIPIENTS.monthly;
  const result = await sendMail({
    to: recipients,
    subject: `Monthly Operations Audit Report — ${monthName} (${monthAvg}% Compliance)`,
    html,
  });

  // Automatically execute image cleanup for this completed month!
  try {
    await cleanupMonthlyImages(prefix);
  } catch (err) {
    console.error("[CLEANUP] Post-monthly image cleanup error:", err.message);
  }

  return result;
}

// -------------------------------------------------------------
// 4. QUARTERLY REPORT (Vineeta, Mannat & Anil Purdhani)
// -------------------------------------------------------------
async function generateAndSendQuarterlyReport(year = new Date().getFullYear(), quarter = Math.floor((new Date().getMonth() + 3) / 3), customRecipients = null) {
  const quarterMonths = {
    1: ["01", "02", "03"],
    2: ["04", "05", "06"],
    3: ["07", "08", "09"],
    4: ["10", "11", "12"],
  };

  const months = quarterMonths[quarter] || quarterMonths[1];
  const quarterLabel = `Q${quarter} ${year} (${months[0]}/${year} - ${months[2]}/${year})`;

  const { Items: users } = await docClient.send(new ScanCommand({ TableName: Tables.USERS }));
  const employees = (users || []).filter((u) => u.role === "employee");
  const cmList = employees.filter((u) => u.designation === "cm");

  const startPrefix = `${year}-${months[0]}-01`;
  const endPrefix = `${year}-${months[2]}-31`;

  const { Items: completions } = await docClient.send(new ScanCommand({
    TableName: Tables.COMPLETIONS,
    FilterExpression: "periodKey BETWEEN :start AND :end",
    ExpressionAttributeValues: { ":start": startPrefix, ":end": endPrefix },
  }));

  const { Items: visitors } = await docClient.send(new ScanCommand({ TableName: Tables.VISITORS }));
  const { Items: issues } = await docClient.send(new ScanCommand({ TableName: Tables.ISSUES }));

  const qVisitors = (visitors || []).filter((v) => v.date >= startPrefix && v.date <= endPrefix);
  const qIssues = (issues || []).filter((i) => i.createdAt >= startPrefix && i.createdAt <= `${endPrefix}T23:59:59`);

  const doneMap = {};
  for (const c of (completions || [])) {
    doneMap[c.userId] = (doneMap[c.userId] || 0) + 1;
  }

  const cmRows = cmList.map((cm) => {
    const supervisors = employees.filter((e) => e.supervisor_id === cm.id);
    const team = supervisors.length > 0 ? supervisors : [cm];
    const totalDone = team.reduce((sum, e) => sum + (doneMap[e.id] || 0), 0);
    const expected = team.length * 97 * 90;
    const score = expected > 0 ? Math.min(100, Math.round((totalDone / expected) * 100)) : 0;
    return {
      name: cm.name,
      location: cm.location,
      score,
      totalDone,
    };
  });

  cmRows.sort((a, b) => b.score - a.score);
  const qAvg = cmRows.length > 0 ? Math.round(cmRows.reduce((s, c) => s + c.score, 0) / cmRows.length) : 0;

  let tableRows = cmRows.map((r) => `
    <tr style="border-bottom: 1px solid #EDF2F7;">
      <td style="padding: 10px 12px; font-weight: 700; color: #2D3748;">${escapeHtml(r.name)}</td>
      <td style="padding: 10px 12px; color: #4A5568;">${escapeHtml(r.location)}</td>
      <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: ${r.score >= 80 ? '#2E7D32' : '#FF5A00'};">
        ${r.score}%
      </td>
      <td style="padding: 10px 12px; text-align: center; color: #718096; font-size: 12px;">${r.totalDone}</td>
    </tr>
  `).join("");

  const html = `
    <div style="${getEmailStyles()}">
      ${getHeaderHtml(`Quarterly Operations & Facility Report`, `Executive Performance Summary for ${quarterLabel}`, "QUARTERLY REPORT")}

      <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Quarterly Audit Score</div>
          <div style="font-size: 22px; font-weight: 800; color: #FF5A00; margin-top: 4px;">${qAvg}%</div>
        </div>
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Quarterly Footfall</div>
          <div style="font-size: 22px; font-weight: 800; color: #2D3748; margin-top: 4px;">${qVisitors.length}</div>
        </div>
        <div style="flex: 1; background: #F7FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 600;">Maintenance Issues</div>
          <div style="font-size: 22px; font-weight: 800; color: #C62828; margin-top: 4px;">${qIssues.length}</div>
        </div>
      </div>

      <h3 style="color: #2D3748; font-size: 14px; margin-bottom: 8px;">Quarterly Centre Performance Matrix</h3>
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background: #EDF2F7; color: #4A5568; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px 12px;">CM</th>
            <th style="padding: 8px 12px;">Centre Location</th>
            <th style="padding: 8px 12px; text-align: center;">Quarter Score</th>
            <th style="padding: 8px 12px; text-align: center;">Tasks Completed</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div style="margin-top: 20px; padding: 12px; background: #F7FAFC; border: 1px solid #E2E8F0; border-radius: 6px; font-size: 12px; color: #4A5568;">
        <strong>Quarterly Data Retention Notice:</strong> Now that the quarterly report has concluded, historical task logs older than 90 days will be cleaned up in accordance with our 3-month retention policy.
      </div>

      ${getFooterHtml()}
    </div>
  `;

  const recipients = customRecipients || REPORT_RECIPIENTS.quarterly;
  const result = await sendMail({
    to: recipients,
    subject: `Quarterly Executive Operations Report — ${quarterLabel} (${qAvg}% Score)`,
    html,
  });

  // Automatically execute 90-day historical data cleanup!
  try {
    const cutoffDate = todayKey(-90);
    await cleanupQuarterlyData(cutoffDate);
  } catch (err) {
    console.error("[CLEANUP] Post-quarterly data cleanup error:", err.message);
  }

  return result;
}

// -------------------------------------------------------------
// 5. DATA CLEANUP ROUTINES
// -------------------------------------------------------------

// Monthly Image Cleanup: Deletes R2 images and checklist_photos records for a given month prefix (e.g. "2026-08")
async function cleanupMonthlyImages(monthPrefix) {
  console.log(`[CLEANUP] Starting monthly image cleanup for prefix: ${monthPrefix}...`);

  const { Items: photos } = await docClient.send(new ScanCommand({
    TableName: Tables.CHECKLIST_PHOTOS,
    FilterExpression: "begins_with(periodKey, :pref)",
    ExpressionAttributeValues: { ":pref": monthPrefix },
  }));

  const items = photos || [];
  let deletedFromR2 = 0;
  let deletedRecords = 0;

  for (const p of items) {
    if (p.photo_url) {
      try {
        await deleteFromR2(p.photo_url);
        deletedFromR2++;
      } catch (err) {
        console.warn(`[CLEANUP] Could not delete R2 photo ${p.photo_url}:`, err.message);
      }
    }
    await docClient.send(new DeleteCommand({
      TableName: Tables.CHECKLIST_PHOTOS,
      Key: { id: p.id },
    }));
    deletedRecords++;
  }

  console.log(`[CLEANUP] Monthly Image Cleanup Finished: ${deletedFromR2} R2 images deleted, ${deletedRecords} DB records removed.`);
  return { deletedFromR2, deletedRecords };
}

// Quarterly Data Cleanup: Purges completions older than 90 days
async function cleanupQuarterlyData(cutoffDateStr = todayKey(-90)) {
  console.log(`[CLEANUP] Starting 90-day quarterly data cleanup for records older than: ${cutoffDateStr}...`);

  const { Items: oldCompletions } = await docClient.send(new ScanCommand({
    TableName: Tables.COMPLETIONS,
    FilterExpression: "periodKey < :cutoff",
    ExpressionAttributeValues: { ":cutoff": cutoffDateStr },
  }));

  const items = oldCompletions || [];
  let deleted = 0;

  for (const c of items) {
    await docClient.send(new DeleteCommand({
      TableName: Tables.COMPLETIONS,
      Key: { userId: c.userId, taskId_periodKey: c.taskId_periodKey },
    }));
    deleted++;
  }

  console.log(`[CLEANUP] Quarterly Data Cleanup Finished: ${deleted} old completion records purged.`);
  return { deleted };
}

module.exports = {
  generateAndSendDailyReport,
  generateAndSendWeeklyReport,
  generateAndSendMonthlyReport,
  generateAndSendQuarterlyReport,
  cleanupMonthlyImages,
  cleanupQuarterlyData,
};
