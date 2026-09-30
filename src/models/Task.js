const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true, index: true },
    name: { type: String, required: true },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "daily" },
    sort_order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "tasks" }
);

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
