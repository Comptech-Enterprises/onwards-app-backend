const mongoose = require("mongoose");

const errorLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    level: { type: String, default: "error", index: true },
    message: { type: String, required: true },
    stack: { type: String, default: null },
    endpoint: { type: String, default: null },
    method: { type: String, default: null },
    status_code: { type: Number, default: 500 },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: "error_logs" }
);

module.exports = mongoose.models.ErrorLog || mongoose.model("ErrorLog", errorLogSchema);
