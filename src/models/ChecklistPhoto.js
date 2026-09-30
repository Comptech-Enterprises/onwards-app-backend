const mongoose = require("mongoose");

const checklistPhotoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    userPeriod: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    periodKey: { type: String, required: true, index: true },
    photo_url: { type: String, required: true },
    uploaded_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: "checklist_photos" }
);

checklistPhotoSchema.index({ userPeriod: 1, category: 1 });

module.exports = mongoose.models.ChecklistPhoto || mongoose.model("ChecklistPhoto", checklistPhotoSchema);
