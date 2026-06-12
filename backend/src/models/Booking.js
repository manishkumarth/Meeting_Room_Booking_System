const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:MM (e.g. "09:00")
    endTime: { type: String, required: true },   // HH:MM (e.g. "10:30")
    bookedBy: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
    },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["confirmed", "cancelled-refundable", "cancelled-non-refundable"],
      default: "confirmed",
    },
    // Section 4.1: recurring support
    recurringGroupId: { type: String, default: null },
    recurringIndex: { type: Number, default: null },
    // Section 4.4: optimistic locking
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ─── CORE CONCURRENCY SAFEGUARD (Section 3.1) ───────────────────────────────
// A unique compound index on room + date + startTime means if two simultaneous
// requests try to insert the same slot, MongoDB guarantees exactly ONE succeeds
// and the other gets a duplicate key error (E11000). We catch that and return 409.
//
// For multi-slot bookings we use a MongoDB transaction (see bookingController)
// so either ALL slots are created or NONE — no partial bookings.
bookingSchema.index(
  { room: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "confirmed", // Only block confirmed bookings; cancelled slots are free
    },
  }
);

// Index for fast lookups by email
bookingSchema.index({ "bookedBy.email": 1 });

// Index for recurring group queries
bookingSchema.index({ recurringGroupId: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
