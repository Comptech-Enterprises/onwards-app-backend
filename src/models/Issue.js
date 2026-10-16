const mongoose = require("mongoose");

const progressHistorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    status: {
      type: String,
      enum: ["Unattended", "In progress", "Resolved"],
      required: true,
    },
    note: { type: String, default: "" },
    updated_by_id: { type: String, default: null },
    updated_by_name: { type: String, default: "System" },
    updated_by_role: { type: String, default: null },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { _id: false }
);

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

    // Issue photo (strictly enforced on creation via controller & frontend)
    photo_url: { type: String, default: null },

    status: {
      type: String,
      enum: ["Unattended", "In progress", "Resolved"],
      default: "Unattended",
      index: true,
    },

    // Hierarchy mapping: Centre Manager and Cluster Manager
    cm_id: { type: String, default: null, index: true },
    cm_name: { type: String, default: null },
    cluster_manager_id: { type: String, default: null, index: true },
    cluster_manager_name: { type: String, default: null },

    // Latest progress tracking
    progress_note: { type: String, default: null },
    progress_updated_by: { type: String, default: null },
    progress_updated_by_role: { type: String, default: null },
    progress_updated_at: { type: String, default: null },
    progress_history: { type: [progressHistorySchema], default: [] },

    // 3-Day Escalation to Vineeta & Mannat
    escalation_sent: { type: Boolean, default: false, index: true },
    escalated_at: { type: String, default: null },
    escalated_to: { type: [String], default: [] },

    notified_email: { type: String, default: "operations@onwardworkspaces.com" },
    created_at: { type: String, default: () => new Date().toISOString(), index: true },
    updated_at: { type: String, default: null },
    resolved_at: { type: String, default: null },
  },
  { timestamps: true, collection: "issues" }
);

module.exports = mongoose.models.Issue || mongoose.model("Issue", issueSchema);
