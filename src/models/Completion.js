const mongoose = require("mongoose");

const completionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    taskId: { type: String, required: true, index: true },
    periodKey: { type: String, required: true, index: true },
    taskId_periodKey: { type: String, required: true, index: true },
    completed_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: "completions" }
);

completionSchema.index({ userId: 1, taskId_periodKey: 1 }, { unique: true });
completionSchema.index({ periodKey: 1, userId: 1 });

module.exports = mongoose.models.Completion || mongoose.model("Completion", completionSchema);
