const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    floor: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    amenities: [{ type: String }],
    bufferMinutes: { type: Number, default: 0 }, // Section 4.3: buffer time
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
