const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    employee_id: { type: String, index: true },
    employee_name: { type: String, default: "Unknown" },
    location: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    notes: { type: String, default: "" },
    description: { type: String, default: "" },
    photo_url: { type: String, default: null },
    status: {
      type: String,
      enum: ["Unattended", "In progress", "Resolved"],
      default: "Unattended",
      index: true,
    },
    notified_email: { type: String, default: "operations@onwardworkspaces.com" },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: null },
    resolved_at: { type: String, default: null },
  },
  { timestamps: true, collection: "issues" }
);

module.exports = mongoose.models.Issue || mongoose.model("Issue", issueSchema);
