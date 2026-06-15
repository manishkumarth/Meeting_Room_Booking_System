const express = require("express");
const router = express.Router();
const { listRooms, getRoom, getRoomAvailability, createRoom} = require("../controllers/roomController");

router.get("/", listRooms);
router.get("/:id", getRoom);
router.get("/:id/availability", getRoomAvailability);
router.post("/create-room", createRoom);

module.exports = router;
