const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    employee_name: { type: String, default: "Unknown" },
    location: { type: String, required: true, index: true },
    visit_date: { type: String, required: true, index: true },
    guest_name: { type: String, default: null },
    facility_type: { type: String, default: null },
    source: {
      type: String,
      default: "Direct",
    },
    aggregator: { type: String, default: "NA" },
    arrival_time: { type: String, default: null },
    punch_out_time: { type: String, default: null },
    seats: { type: Number, default: 1 },
    payment: { type: String, default: null },
    amount_received: { type: Number, default: 0 },
    invoice_tech_monk: { type: String, default: "No" },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true, collection: "visitors" }
);

module.exports = mongoose.models.Visitor || mongoose.model("Visitor", visitorSchema);
