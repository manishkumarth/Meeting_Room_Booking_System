const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Waitlist = require("../models/Waitlist");
const Room = require("../models/Room");
const { v4: uuidv4 } = require("crypto").webcrypto
  ? (() => {
      try { return require("crypto"); } catch { return { randomUUID: () => Math.random().toString(36).slice(2) }; }
    })()
  : require("crypto");

// Helper: generate UUID (node built-in)
function generateId() {
  try {
    return require("crypto").randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
}

// ── Time helpers ─────────────────────────────────────────────────────────────
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/**
 * Expand startTime → endTime into 30-min slot start times
 * e.g. "09:00" → "10:30"  ==>  ["09:00", "09:30", "10:00"]
 */
function expandSlots(startTime, endTime) {
  const slots = [];
  let cur = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  while (cur < end) {
    slots.push(minutesToTime(cur));
    cur += 30;
  }
  return slots;
}

// ── POST /api/bookings ────────────────────────────────────────────────────────
/**
 * CONCURRENCY STRATEGY (Section 3.1):
 *
 * We use a MongoDB transaction + the unique compound index on (room, date, startTime)
 * (partialFilterExpression: status = "confirmed").
 *
 * Flow:
 *   1. Inside a transaction, check all requested slots are free.
 *   2. Attempt to insertMany all slot documents atomically.
 *   3. If any insert fails with E11000 (duplicate key), abort the whole transaction.
 *
 * This means two simultaneous requests for the same slot both read "free",
 * but only ONE can win the race at the DB insert level — the other gets a
 * 409 Conflict. No partial bookings possible for multi-slot requests.
 */
const createBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { roomId, date, startTime, endTime, bookedBy, title } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!roomId || !date || !startTime || !endTime || !bookedBy?.name || !bookedBy?.email || !title) {
      return res.status(400).json({ error: "Missing required fields: roomId, date, startTime, endTime, bookedBy.name, bookedBy.email, title" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return res.status(400).json({ error: "startTime must be before endTime" });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Buffer check: does startTime fall during another booking's buffer window? (Section 4.3)
    if (room.bufferMinutes > 0) {
      const precedingBookings = await Booking.find({
        room: roomId,
        date,
        status: "confirmed",
        endTime: { $lte: startTime },
      }).lean();

      for (const b of precedingBookings) {
        const bEnd = timeToMinutes(b.endTime);
        const bBufferEnd = bEnd + room.bufferMinutes;
        const reqStart = timeToMinutes(startTime);
        if (reqStart < bBufferEnd) {
          return res.status(409).json({
            error: `Booking conflicts with buffer time after booking ending at ${b.endTime}. Buffer is ${room.bufferMinutes} minutes.`,
          });
        }
      }
    }

    const slots = expandSlots(startTime, endTime);
    if (slots.length === 0) {
      return res.status(400).json({ error: "Invalid time range — must cover at least one 30-min slot" });
    }

    // Section 4.5: per-user daily quota (4 hours = 240 minutes)
    const DAILY_QUOTA_MINUTES = 240;
    const requestedMinutes = slots.length * 30;
    const existingBookings = await Booking.find({
      "bookedBy.email": bookedBy.email.toLowerCase(),
      date,
      status: "confirmed",
    }).lean();
    const usedMinutes = existingBookings.reduce((acc, b) => {
      return acc + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime));
    }, 0);
    if (usedMinutes + requestedMinutes > DAILY_QUOTA_MINUTES) {
      return res.status(409).json({
        error: `Daily booking quota exceeded. You have ${DAILY_QUOTA_MINUTES - usedMinutes} minutes remaining for ${date}.`,
        quotaRemaining: DAILY_QUOTA_MINUTES - usedMinutes,
      });
    }

    // ── Transaction: check + insert atomically ────────────────────────────────
    let createdBookings;
    await session.withTransaction(async () => {
      // Inside transaction: verify all slots are free
      const conflicts = await Booking.find({
        room: roomId,
        date,
        startTime: { $in: slots },
        status: "confirmed",
      }).session(session).lean();

      if (conflicts.length > 0) {
        const conflictTimes = conflicts.map((c) => c.startTime).join(", ");
        const err = new Error(`Slot(s) already booked: ${conflictTimes}`);
        err.status = 409;
        throw err;
      }

      // Build all slot documents
      const docs = slots.map((slotStart) => ({
        room: roomId,
        date,
        startTime: slotStart,
        endTime: minutesToTime(timeToMinutes(slotStart) + 30),
        bookedBy: { name: bookedBy.name, email: bookedBy.email.toLowerCase() },
        title,
        status: "confirmed",
      }));

      // insertMany inside transaction — unique index enforces atomicity
      createdBookings = await Booking.insertMany(docs, { session });
    });

    res.status(201).json({
      message: "Booking confirmed",
      bookings: createdBookings,
      slotsBooked: slots.length,
    });
  } catch (err) {
    // E11000 = MongoDB duplicate key (race condition caught at DB level)
    if (err.code === 11000 || err.message?.includes("E11000")) {
      return res.status(409).json({ error: "Booking conflict: one or more slots were just taken by another user." });
    }
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  } finally {
    session.endSession();
  }
};

// ── POST /api/bookings/recurring ─────────────────────────────────────────────
/**
 * Section 4.1: Recurring bookings with partial-conflict handling.
 * Checks all occurrences upfront, reports conflicts, lets user choose:
 *   - "book_free": book only non-conflicting occurrences
 *   - "cancel_all": don't book anything
 */
const createRecurringBooking = async (req, res, next) => {
  try {
    const { roomId, startDate, startTime, endTime, bookedBy, title, weeks, onConflict = "report" } = req.body;

    if (!roomId || !startDate || !startTime || !endTime || !bookedBy?.name || !bookedBy?.email || !title || !weeks) {
      return res.status(400).json({ error: "Missing required fields for recurring booking" });
    }

    // Generate all occurrence dates (weekly)
    const occurrences = [];
    const base = new Date(startDate + "T00:00:00");
    for (let i = 0; i < weeks; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i * 7);
      occurrences.push(d.toISOString().slice(0, 10));
    }

    const slots = expandSlots(startTime, endTime);

    // Check all occurrences for conflicts
    const conflictingDates = [];
    const freeDates = [];

    for (const date of occurrences) {
      const conflicts = await Booking.find({
        room: roomId,
        date,
        startTime: { $in: slots },
        status: "confirmed",
      }).lean();

      if (conflicts.length > 0) {
        conflictingDates.push(date);
      } else {
        freeDates.push(date);
      }
    }

    // If caller just wants a report (pre-flight check)
    if (onConflict === "report") {
      return res.json({
        occurrences,
        conflictingDates,
        freeDates,
        hasConflicts: conflictingDates.length > 0,
      });
    }

    // If all conflict → reject entirely
    if (freeDates.length === 0) {
      return res.status(409).json({
        error: "All requested occurrences conflict with existing bookings.",
        conflictingDates,
      });
    }

    // If user chose "cancel_all" and there are conflicts
    if (onConflict === "cancel_all" && conflictingDates.length > 0) {
      return res.status(409).json({
        error: "Some occurrences conflict. No bookings created.",
        conflictingDates,
        freeDates,
      });
    }

    // Book only free dates (onConflict === "book_free")
    const datesToBook = onConflict === "book_free" ? freeDates : occurrences;
    const groupId = generateId();
    const session = await mongoose.startSession();
    let createdAll = [];

    await session.withTransaction(async () => {
      for (let idx = 0; idx < datesToBook.length; idx++) {
        const date = datesToBook[idx];
        const docs = slots.map((slotStart) => ({
          room: roomId,
          date,
          startTime: slotStart,
          endTime: minutesToTime(timeToMinutes(slotStart) + 30),
          bookedBy: { name: bookedBy.name, email: bookedBy.email.toLowerCase() },
          title,
          status: "confirmed",
          recurringGroupId: groupId,
          recurringIndex: idx,
        }));
        const created = await Booking.insertMany(docs, { session });
        createdAll.push(...created);
      }
    });
    session.endSession();

    res.status(201).json({
      message: `Recurring booking created for ${datesToBook.length} occurrence(s).`,
      groupId,
      bookedDates: datesToBook,
      skippedDates: conflictingDates,
      bookings: createdAll,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Conflict detected during booking. Please retry." });
    }
    next(err);
  }
};

// ── GET /api/bookings?email=... ───────────────────────────────────────────────
const getUserBookings = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "email query param required" });

    const bookings = await Booking.find({ "bookedBy.email": email.toLowerCase() })
      .populate("room", "name location floor capacity")
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.json(bookings);
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/bookings/:id/cancel ───────────────────────────────────────────
/**
 * Section 3.2: Refund window computed server-side from server clock.
 * Section 4.2: After cancel, atomically promote next waitlisted user.
 */
const cancelBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { cancelType } = req.body; // "single" | "this_and_future" (for recurring)

    const booking = await Booking.findById(id).session(session).populate("room");
    if (!booking) {
      session.endSession();
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.status !== "confirmed") {
      session.endSession();
      return res.status(400).json({ error: "Booking is already cancelled" });
    }

    // Server-side refund window check (Section 3.2)
    const now = new Date();
    const bookingStart = new Date(`${booking.date}T${booking.startTime}:00`);
    const hoursUntilStart = (bookingStart - now) / (1000 * 60 * 60);
    const isRefundable = hoursUntilStart >= 2;
    const newStatus = isRefundable ? "cancelled-refundable" : "cancelled-non-refundable";

    let cancelledBookings = [];

    await session.withTransaction(async () => {
      // For recurring: "this_and_future" cancels all future occurrences in group
      if (booking.recurringGroupId && cancelType === "this_and_future") {
        const toCancel = await Booking.find({
          recurringGroupId: booking.recurringGroupId,
          recurringIndex: { $gte: booking.recurringIndex },
          status: "confirmed",
        }).session(session);

        for (const b of toCancel) {
          const bStart = new Date(`${b.date}T${b.startTime}:00`);
          const hrs = (bStart - now) / (1000 * 60 * 60);
          b.status = hrs >= 2 ? "cancelled-refundable" : "cancelled-non-refundable";
          await b.save({ session });
          cancelledBookings.push(b);
        }
      } else {
        // Single cancellation
        booking.status = newStatus;
        await booking.save({ session });
        cancelledBookings.push(booking);
      }

      // Section 4.2: Waitlist auto-promotion (atomic)
      // For each cancelled booking's slot, try to promote next waitlisted user
      for (const cancelled of cancelledBookings) {
        const nextWaiting = await Waitlist.findOneAndUpdate(
          {
            room: cancelled.room._id || cancelled.room,
            date: cancelled.date,
            startTime: cancelled.startTime,
            status: "waiting",
          },
          { $set: { status: "promoted" } },
          { sort: { position: 1 }, session, new: true }
        );

        if (nextWaiting) {
          // Create a confirmed booking for the promoted user
          await Booking.create(
            [
              {
                room: cancelled.room._id || cancelled.room,
                date: cancelled.date,
                startTime: cancelled.startTime,
                endTime: cancelled.endTime,
                bookedBy: nextWaiting.user,
                title: nextWaiting.title,
                status: "confirmed",
              },
            ],
            { session }
          );
        }
      }
    });

    res.json({
      message: "Booking cancelled",
      status: newStatus,
      refundable: isRefundable,
      hoursUntilStart: Math.round(hoursUntilStart * 10) / 10,
      cancelledCount: cancelledBookings.length,
    });
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
};

// ── POST /api/bookings/:id/reschedule ────────────────────────────────────────
/**
 * Section 4.4: Reschedule with optimistic locking.
 * Old slot freed and new slot reserved atomically in one transaction.
 */
const rescheduleBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { newDate, newStartTime, newEndTime, version } = req.body;

    if (!newDate || !newStartTime || !newEndTime || version === undefined) {
      session.endSession();
      return res.status(400).json({ error: "newDate, newStartTime, newEndTime, and version are required" });
    }

    await session.withTransaction(async () => {
      // Optimistic locking: reject if booking changed since form was opened
      const booking = await Booking.findOne({ _id: id, version }).session(session);
      if (!booking) {
        const err = new Error("Booking has been modified since you opened the form. Please refresh and try again.");
        err.status = 409;
        throw err;
      }
      if (booking.status !== "confirmed") {
        const err = new Error("Cannot reschedule a cancelled booking");
        err.status = 400;
        throw err;
      }

      const newSlots = expandSlots(newStartTime, newEndTime);

      // Check new slots are free (excluding this booking's old slots)
      const conflicts = await Booking.find({
        room: booking.room,
        date: newDate,
        startTime: { $in: newSlots },
        status: "confirmed",
        _id: { $ne: id },
      }).session(session).lean();

      if (conflicts.length > 0) {
        const err = new Error(`New slot(s) conflict: ${conflicts.map((c) => c.startTime).join(", ")}`);
        err.status = 409;
        throw err;
      }

      const oldSlots = expandSlots(booking.startTime, booking.endTime);

      // Delete old slot docs and insert new ones — atomically
      await Booking.deleteMany({ _id: id }).session(session);

      // Also delete sibling slot docs for multi-slot bookings
      // (they share same bookedBy.email, date, title, and consecutive times)
      if (oldSlots.length > 1) {
        await Booking.deleteMany({
          room: booking.room,
          date: booking.date,
          startTime: { $in: oldSlots.slice(1) },
          "bookedBy.email": booking.bookedBy.email,
          title: booking.title,
          status: "confirmed",
        }).session(session);
      }

      const newDocs = newSlots.map((slotStart) => ({
        room: booking.room,
        date: newDate,
        startTime: slotStart,
        endTime: minutesToTime(timeToMinutes(slotStart) + 30),
        bookedBy: booking.bookedBy,
        title: booking.title,
        status: "confirmed",
        version: (booking.version || 0) + 1,
      }));

      await Booking.insertMany(newDocs, { session });
    });

    res.json({ message: "Booking rescheduled successfully" });
  } catch (err) {
    if (err.status === 409 || err.status === 400) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: "New slot taken by concurrent request. Please try again." });
    }
    next(err);
  } finally {
    session.endSession();
  }
};

// ── POST /api/bookings/:id/waitlist ──────────────────────────────────────────
const joinWaitlist = async (req, res, next) => {
  try {
    const { room, date, startTime, endTime, user, title } = req.body;
    if (!room || !date || !startTime || !endTime || !user?.name || !user?.email || !title) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Find current queue length
    const queueLength = await Waitlist.countDocuments({
      room,
      date,
      startTime,
      status: "waiting",
    });

    const entry = await Waitlist.create({
      room,
      date,
      startTime,
      endTime,
      user: { name: user.name, email: user.email.toLowerCase() },
      title,
      position: queueLength + 1,
    });

    res.status(201).json({
      message: `Added to waitlist at position ${entry.position}`,
      waitlistEntry: entry,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "You are already on the waitlist for this slot." });
    }
    next(err);
  }
};

module.exports = {
  createBooking,
  createRecurringBooking,
  getUserBookings,
  cancelBooking,
  rescheduleBooking,
  joinWaitlist,
};
