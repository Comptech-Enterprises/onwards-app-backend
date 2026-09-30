const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["employee", "manager"], default: "employee" },
    designation: { type: String, default: "supervisor" },
    location: { type: String, default: "All centres" },
    supervisor_id: { type: String, default: null },
    manager_id: { type: String, default: null },
    employee_code: { type: String, default: null },
    phone: { type: String, default: null },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "users" }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
