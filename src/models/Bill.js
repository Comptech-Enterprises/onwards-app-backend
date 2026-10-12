const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    employee_id: { type: String, index: true },
    employee_name: { type: String, default: "Unknown" },
    employee_code: { type: String, default: null },
    designation: { type: String, default: "supervisor" },
    location: { type: String, required: true, index: true },

    // Centre Manager (CM) Information
    cm_id: { type: String, default: null, index: true },
    cm_name: { type: String, default: null },

    // Cluster Manager Information
    cluster_manager_id: { type: String, default: null, index: true },
    cluster_manager_name: { type: String, default: null },

    // Item & Expense Details
    item_name: { type: String, required: true, trim: true, index: true },
    remark: { type: String, default: "", trim: true },
    amount: { type: Number, default: null },

    // File Upload Details (Supports single or multiple page images)
    file_url: { type: String, required: true },
    file_urls: { type: [String], default: [] },
    file_type: { type: String, default: "image" },
    file_name: { type: String, default: null },
    file_size: { type: Number, default: null },

    // Review / Approval Status
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    status_remark: { type: String, default: null },
    reviewed_by: { type: String, default: null },
    reviewed_at: { type: String, default: null },

    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: null },
  },
  { timestamps: true, collection: "bills" }
);

module.exports = mongoose.models.Bill || mongoose.model("Bill", billSchema);
