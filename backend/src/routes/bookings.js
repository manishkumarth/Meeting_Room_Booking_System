const express = require("express");
const router = express.Router();
const {
  createBooking,
  createRecurringBooking,
  getUserBookings,
  cancelBooking,
  rescheduleBooking,
  joinWaitlist,
} = require("../controllers/bookingController");

router.post("/", createBooking);
router.post("/recurring", createRecurringBooking);
router.get("/", getUserBookings);
router.patch("/:id/cancel", cancelBooking);
router.patch("/:id/reschedule", rescheduleBooking);
router.post("/waitlist", joinWaitlist);

module.exports = router;
