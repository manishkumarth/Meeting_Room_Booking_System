const mongoose = require("mongoose");

// Section 4.2: Waitlist with atomic auto-promotion
const waitlistSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    user: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
    },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ["waiting", "promoted", "expired"],
      default: "waiting",
    },
    position: { type: Number, required: true }, // queue position
  },
  { timestamps: true }
);

// Unique: one user per slot on waitlist
waitlistSchema.index(
  { room: 1, date: 1, startTime: 1, "user.email": 1 },
  { unique: true, partialFilterExpression: { status: "waiting" } }
);

// For finding next in queue
waitlistSchema.index({ room: 1, date: 1, startTime: 1, position: 1 });

module.exports = mongoose.model("Waitlist", waitlistSchema);
