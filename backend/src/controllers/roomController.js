const Room = require("../models/Room");
const Booking = require("../models/Booking");

// GET /api/rooms
const listRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find().sort({ name: 1 });
    console.log("req",rooms)
    res.json(rooms);
  } catch (err) {
    next(err);
  }
};
// GET /api/rooms?search=term

// GET /api/rooms/:id
const getRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room);
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id/availability?date=YYYY-MM-DD
// Returns a slot grid with availability for every 30-min slot (08:00–20:00)
const getRoomAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
    }

    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Fetch all confirmed bookings for this room+date
    const bookings = await Booking.find({
      room: id,
      date,
      status: "confirmed",
    }).lean();

    // Build slot grid: 08:00 to 20:00 in 30-min steps
    const slots = generateSlots("08:00", "20:00", 30);

    // Mark occupied slots (including buffer time — Section 4.3)
    const bufferMins = room.bufferMinutes || 0;

    const result = slots.map((slot) => {
      const slotStart = timeToMinutes(slot);
      const slotEnd = slotStart + 30;

      let status = "available";
      let bookingId = null;
      let bookedBy = null;

      for (const booking of bookings) {
        const bStart = timeToMinutes(booking.startTime);
        const bEnd = timeToMinutes(booking.endTime);
        const bBufferEnd = bEnd + bufferMins;

        // Slot overlaps with booking itself
        if (slotStart < bEnd && slotEnd > bStart) {
          status = "booked";
          bookingId = booking._id;
          bookedBy = booking.bookedBy?.name || "Someone";
          break;
        }

        // Slot falls within buffer period after booking (Section 4.3)
        if (bufferMins > 0 && slotStart >= bEnd && slotStart < bBufferEnd) {
          status = "buffer";
          break;
        }
      }

      return {
        time: slot,
        status,
        bookingId,
        bookedBy,
      };
    });

    res.json({
      room: { _id: room._id, name: room.name, location: room.location, floor: room.floor, capacity: room.capacity, bufferMinutes: room.bufferMinutes },
      date,
      slots: result,
    });
  } catch (err) {
    next(err);
  }
};

// ── helpers ──────────────────────────────────────────────────────────────────
function generateSlots(startTime, endTime, stepMinutes) {
  const slots = [];
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  while (current < end) {
    slots.push(minutesToTime(current));
    current += stepMinutes;
  }
  return slots;
}

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

module.exports = { listRooms, getRoom, getRoomAvailability };
