const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const REPORT_RECIPIENTS = {
  daily: [
    "operations@onwardworkspaces.com",
    "ravipawar@onwardworkspaces.com",
    "abhishek.gupta@onwardworkspaces.com",
  ],
  weekly: [
    "operations@onwardworkspaces.com",
    "ravipawar@onwardworkspaces.com",
    "abhishek.gupta@onwardworkspaces.com",
    "vineeta@onwardworkspaces.com",
    "Mannat@onwardworkspaces.com",
  ],
  monthly: [
    "operations@onwardworkspaces.com",
    "ravipawar@onwardworkspaces.com",
    "abhishek.gupta@onwardworkspaces.com",
    "vineeta@onwardworkspaces.com",
    "Mannat@onwardworkspaces.com",
  ],
  quarterly: [
    "operations@onwardworkspaces.com",
    "ravipawar@onwardworkspaces.com",
    "abhishek.gupta@onwardworkspaces.com",
    "vineeta@onwardworkspaces.com",
    "Mannat@onwardworkspaces.com",
    "anilpurdhani@gmail.com",
  ],
};

async function sendMail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY not configured.");

  const senderEmail = process.env.MAIL_FROM_EMAIL || "mannat@onwardworkspaces.com";
  const senderName = process.env.MAIL_FROM_NAME || "Onward Workspaces";

  const recipientList = Array.isArray(to) ? to : [to];
  if (recipientList.length === 0) throw new Error("No recipients specified.");

  const body = {
    sender: { name: senderName, email: senderEmail },
    to: recipientList.map((email) => ({ email: email.trim() })),
    subject,
    htmlContent: html,
  };

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${error}`);
  }

  const result = await response.json();
  console.log(`[EMAIL] Sent "${subject}" to ${recipientList.join(", ")} (messageId: ${result.messageId})`);
  return result;
}

module.exports = {
  REPORT_RECIPIENTS,
  sendMail,
};
