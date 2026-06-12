require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("./models/Room");
const Booking = require("./models/Booking");
const Waitlist = require("./models/Waitlist");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/roomit";

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A booking starting in ~1 hour (within 2-hour non-refundable window)
function soonTime() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(time, mins) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

 async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  // Clear existing data
  await Promise.all([Room.deleteMany({}), Booking.deleteMany({}), Waitlist.deleteMany({})]);
  console.log("Cleared existing data");

  // Create 4 rooms (with varied buffer times for Section 4.3 demo)
  const rooms = await Room.insertMany([
  {
    name: "HCL Conference Room",
    location: "Sector 126, Noida",
    floor: "2nd Floor",
    capacity: 12,
    amenities: ["Projector", "Whiteboard", "Video Conferencing"],
    bufferMinutes: 10,
  },
  {
    name: "Tech Hub Meeting Room",
    location: "Sector 62, Noida",
    floor: "3rd Floor",
    capacity: 8,
    amenities: ["TV Screen", "Whiteboard"],
    bufferMinutes: 0,
  },
  {
    name: "Innovation Hall",
    location: "Sector 135, Noida",
    floor: "1st Floor",
    capacity: 25,
    amenities: ["Projector", "Stage", "PA System", "Video Conferencing"],
    bufferMinutes: 15,
  },
  {
    name: "Startup Pod",
    location: "Sector 18, Noida",
    floor: "4th Floor",
    capacity: 4,
    amenities: ["TV Screen"],
    bufferMinutes: 0,
  },
]);
  console.log(`Created ${rooms.length} rooms`);

  const [atlas, zenith, nova, spark] = rooms;
  const today = todayStr();
  const tomorrow = dateOffset(1);
  const yesterday = dateOffset(-1);
  const soon = soonTime();

  // Realistic mix of bookings
  const bookingDocs = [
    // Today — atlas: morning standup confirmed
    { room: atlas._id, date: today, startTime: "09:00", endTime: "09:30", bookedBy: { name: "Priya Sharma", email: "priya@example.com" }, title: "Morning Standup", status: "confirmed" },
    // Today — atlas: afternoon meeting confirmed
    { room: atlas._id, date: today, startTime: "14:00", endTime: "15:00", bookedBy: { name: "Rahul Verma", email: "rahul@example.com" }, title: "Sprint Planning", status: "confirmed" },
    { room: atlas._id, date: today, startTime: "14:30", endTime: "15:00", bookedBy: { name: "Rahul Verma", email: "rahul@example.com" }, title: "Sprint Planning", status: "confirmed" },

    // Today — zenith: a booking starting in ~1 hour (non-refundable window demo)
    { room: zenith._id, date: today, startTime: soon, endTime: addMinutes(soon, 60), bookedBy: { name: "Aisha Khan", email: "aisha@example.com" }, title: "Design Review", status: "confirmed" },
    { room: zenith._id, date: today, startTime: addMinutes(soon, 30), endTime: addMinutes(soon, 60), bookedBy: { name: "Aisha Khan", email: "aisha@example.com" }, title: "Design Review", status: "confirmed" },

    // Today — nova: all morning slots taken
    { room: nova._id, date: today, startTime: "10:00", endTime: "10:30", bookedBy: { name: "Dev Team", email: "dev@example.com" }, title: "All-Hands Q3", status: "confirmed" },
    { room: nova._id, date: today, startTime: "10:30", endTime: "11:00", bookedBy: { name: "Dev Team", email: "dev@example.com" }, title: "All-Hands Q3", status: "confirmed" },
    { room: nova._id, date: today, startTime: "11:00", endTime: "11:30", bookedBy: { name: "Dev Team", email: "dev@example.com" }, title: "All-Hands Q3", status: "confirmed" },

    // Tomorrow — spark: a refundable-window booking (>2 hrs away)
    { room: spark._id, date: tomorrow, startTime: "11:00", endTime: "11:30", bookedBy: { name: "Siddharth Roy", email: "sid@example.com" }, title: "1:1 with Manager", status: "confirmed" },
    { room: spark._id, date: tomorrow, startTime: "15:00", endTime: "16:00", bookedBy: { name: "Priya Sharma", email: "priya@example.com" }, title: "Investor Call", status: "confirmed" },
    { room: spark._id, date: tomorrow, startTime: "15:30", endTime: "16:00", bookedBy: { name: "Priya Sharma", email: "priya@example.com" }, title: "Investor Call", status: "confirmed" },

    // Yesterday — cancelled bookings for history
    { room: atlas._id, date: yesterday, startTime: "09:00", endTime: "09:30", bookedBy: { name: "Priya Sharma", email: "priya@example.com" }, title: "Old Meeting", status: "cancelled-refundable" },
    { room: zenith._id, date: yesterday, startTime: "13:00", endTime: "13:30", bookedBy: { name: "Rahul Verma", email: "rahul@example.com" }, title: "Client Call", status: "cancelled-non-refundable" },
  ];

  await Booking.insertMany(bookingDocs);
  console.log(`Created ${bookingDocs.length} bookings`);

  // Waitlist entry for nova's 10:00 slot
  await Waitlist.create({
    room: nova._id,
    date: today,
    startTime: "10:00",
    endTime: "10:30",
    user: { name: "Kiran Patel", email: "kiran@example.com" },
    title: "Emergency Sync",
    status: "waiting",
    position: 1,
  });
  console.log("Created 1 waitlist entry");

  console.log("\n✅ Seed complete!");
  console.log("\nRoom IDs (copy into .env or use in tests):");
  rooms.forEach((r) => console.log(`  ${r.name}: ${r._id}`));
  console.log(`\nTest emails: priya@example.com, rahul@example.com, aisha@example.com`);
  console.log(`Non-refundable cancel test: aisha@example.com booking at ${soon} today`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

module.exports = { seed };