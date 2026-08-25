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

const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, Tables } = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(async (err, req, res, next) => {
  console.error(err.stack);

  try {
    await docClient.send(new PutCommand({
      TableName: Tables.ERROR_LOGS,
      Item: {
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        level: "error",
        message: err.message || "Unknown error",
        stack: err.stack || null,
        endpoint: req.path || null,
        method: req.method || null,
        status_code: 500,
        created_at: new Date().toISOString(),
      },
    }));
  } catch (logErr) {
    console.error("Failed to write error log:", logErr.message);
  }

  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
