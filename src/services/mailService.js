const nodemailer = require("nodemailer");

function getTransporter() {
  const user = process.env.SMTP_USER || "info@onwardworkspaces.com";
  const pass = (process.env.SMTP_PASS || "lhieuhamjvzuyjdk").replace(/\s+/g, "");

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

const REPORT_RECIPIENTS = {
  daily: [
    "ravipawar@onwardworkspaces.com",
    "abhishek.gupta@onwardworkspaces.com",
  ],
  weekly: [
    "Mannat@onwardworkspaces.com",
    "vineeta@onwardworkspaces.com",
  ],
  monthly: [
    "ravipawar@onwardworkspaces.com",
    "abhishek.gupta@onwardworkspaces.com",
    "vineeta@onwardworkspaces.com",
    "Mannat@onwardworkspaces.com",
  ],
  quarterly: [
    "vineeta@onwardworkspaces.com",
    "Mannat@onwardworkspaces.com",
    "anilpurdhani@gmail.com",
  ],
};

async function sendMail({ to, subject, html }) {
  const transporter = getTransporter();
  const from = `"Onwards Operations" <${process.env.SMTP_USER || "info@onwardworkspaces.com"}>`;
  
  const recipientList = Array.isArray(to) ? to : [to];
  if (recipientList.length === 0) {
    throw new Error("No recipients specified.");
  }

  const info = await transporter.sendMail({
    from,
    to: recipientList.join(", "),
    subject,
    html,
  });

  console.log(`[EMAIL] Sent "${subject}" to ${recipientList.join(", ")} (MessageId: ${info.messageId})`);
  return info;
}

module.exports = {
  getTransporter,
  REPORT_RECIPIENTS,
  sendMail,
};
