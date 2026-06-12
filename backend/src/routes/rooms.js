const express = require("express");
const router = express.Router();
const { listRooms, getRoom, getRoomAvailability } = require("../controllers/roomController");

router.get("/", listRooms);
router.get("/:id", getRoom);
router.get("/:id/availability", getRoomAvailability);

module.exports = router;
