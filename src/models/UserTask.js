const mongoose = require("mongoose");

const userTaskSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    taskId: { type: String, required: true, index: true },
    assigned_at: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "user_tasks" }
);

userTaskSchema.index({ userId: 1, taskId: 1 }, { unique: true });

module.exports = mongoose.models.UserTask || mongoose.model("UserTask", userTaskSchema);
