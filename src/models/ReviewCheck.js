const mongoose = require("mongoose");

const reviewCheckSchema = new mongoose.Schema(
  {
    periodKey: { type: String, required: true, index: true },
    cat_loc_task: { type: String, required: true, index: true },
    category: { type: String, default: "" },
    location: { type: String, default: "" },
    taskId: { type: String, default: "" },
    reviewer_id: { type: String, default: null },
    checked_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: "review_checks" }
);

reviewCheckSchema.index({ periodKey: 1, cat_loc_task: 1 }, { unique: true });

module.exports = mongoose.models.ReviewCheck || mongoose.model("ReviewCheck", reviewCheckSchema);
