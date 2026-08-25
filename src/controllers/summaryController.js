const nodemailer = require("nodemailer");
const { ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("../config/db");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getDailySummary(req, res) {
  const date = req.query.date || todayKey();

  const { Items: allUsers } = await docClient.send(new ScanCommand({
    TableName: Tables.USERS,
    FilterExpression: "#r = :role",
    ExpressionAttributeNames: { "#r": "role" },
    ExpressionAttributeValues: { ":role": "employee" },
  }));

  const employees = (allUsers || []).sort((a, b) => a.name.localeCompare(b.name));

  const { Items: completions } = await docClient.send(new QueryCommand({
    TableName: Tables.COMPLETIONS,
    IndexName: "periodKey-index",
    KeyConditionExpression: "periodKey = :pk",
    ExpressionAttributeValues: { ":pk": date },
  }));

  const doneMap = {};
  for (const row of (completions || [])) {
    doneMap[row.userId] = (doneMap[row.userId] || 0) + 1;
  }

  const rows = [];
  for (const emp of employees) {
    const { Items: tasks } = await docClient.send(new QueryCommand({
      TableName: Tables.USER_TASKS,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": emp.id },
      Select: "COUNT",
    }));
    const total = tasks?.Count ?? 0;
    const done = doneMap[emp.id] || 0;
    const pct = total ? Math.round((done / total) * 100) : 0;
    rows.push({
      name: emp.name,
      location: emp.location || "-",
      done,
      total,
      pct,
    });
  }

  res.json({ date, rows });
}

async function sendSummaryEmail(req, res) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = (process.env.SUMMARY_TO || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!user || !pass || to.length === 0) {
    return res.status(503).json({ ok: false, error: "SMTP not configured." });
  }

  const { date, rows } = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ ok: false, error: "Invalid data." });
  }

  const deadline = process.env.NOTIFY_DEADLINE || "12:30";
  const tableRows = rows
    .map((r) => {
      const done = Number(r.done) || 0;
      const total = Number(r.total) || 0;
      const pct = Number(r.pct) || 0;
      const onTime = r.onTime ? "Yes" : "No";
      return `<tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.location)}</td>
        <td>${done}</td>
        <td>${total}</td>
        <td>${pct}%</td>
        <td>${onTime}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <p>Daily task summary for <strong>${escapeHtml(date)}</strong>.</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <thead>
        <tr><th>CM</th><th>Property</th><th>Done</th><th>Total</th><th>Progress</th><th>On time (${escapeHtml(deadline)})</th></tr>
      </thead>
      <tbody>${tableRows || '<tr><td colspan="6">No employees.</td></tr>'}</tbody>
    </table>
  `;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `Onward Tasks <${user}>`,
      to,
      subject: `Daily task summary — ${escapeHtml(date)}`,
      html,
    });
  } catch (err) {
    return res.status(502).json({ ok: false, error: err.message });
  }

  res.json({ ok: true });
}

module.exports = { getDailySummary, sendSummaryEmail };
