const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, default: "info" },
    title: { type: String, required: true },
    body: { type: String, default: null },
    message: { type: String, default: null },
    is_read: { type: Boolean, default: false },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: "alerts" }
);

module.exports = mongoose.models.Alert || mongoose.model("Alert", alertSchema);
