require("dotenv").config();
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const taskRoutes = require("./routes/tasks");
const completionRoutes = require("./routes/completions");
const reviewRoutes = require("./routes/reviews");
const issueRoutes = require("./routes/issues");
const visitorRoutes = require("./routes/visitors");
const photoRoutes = require("./routes/photos");
const alertRoutes = require("./routes/alerts");
const summaryRoutes = require("./routes/summary");
const errorLogRoutes = require("./routes/errorLogs");
const configRoutes = require("./routes/config");

const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("./config/db");
const nodemailer = require("nodemailer");

const http = require("http");
const { initWebSocket } = require("./ws");

const app = express();
const server = http.createServer(app);
initWebSocket(server);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.send("Hello World — Onwards Workspaces API");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/completions", completionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/error-logs", errorLogRoutes);
app.use("/api/config", configRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(async (err, req, res, next) => {
  if (err.message === 'Request aborted' || err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
    console.warn(`[UPLOAD] Request aborted by client: ${req.method} ${req.path}`);
    if (!res.headersSent) {
      return res.status(400).json({ error: "Upload was cancelled or connection interrupted." });
    }
    return;
  }

  console.error(err.stack);

  const errorId = `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  try {
    await docClient.send(new PutCommand({
      TableName: Tables.ERROR_LOGS,
      Item: {
        id: errorId,
        level: "error",
        message: err.message || "Unknown error",
        stack: err.stack || null,
        endpoint: req.path || null,
        method: req.method || null,
        status_code: 500,
        created_at: timestamp,
      },
    }));
  } catch (logErr) {
    console.error("Failed to write error log:", logErr.message);
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const errorNotifyTo = process.env.ERROR_NOTIFY_TO;
  if (smtpUser && smtpPass && errorNotifyTo) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `Onwards Error Alert <${smtpUser}>`,
        to: errorNotifyTo,
        subject: `[ERROR] ${req.method} ${req.path} — ${err.message || "Unknown error"}`,
        html: `<h3>Error on Onwards API</h3>
<p><strong>ID:</strong> ${errorId}</p>
<p><strong>Time:</strong> ${timestamp}</p>
<p><strong>Endpoint:</strong> ${req.method} ${req.path}</p>
<p><strong>Message:</strong> ${err.message || "Unknown error"}</p>
<pre style="background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto">${err.stack || "No stack trace"}</pre>`,
      });
    } catch (mailErr) {
      console.error("Failed to send error email:", mailErr.message);
    }
  }

  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
