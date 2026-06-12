require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const roomRoutes = require("./routes/rooms");
const bookingRoutes = require("./routes/bookings");

const app = express();

app.use(cors());
app.use(express.json());
// Routes
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/roomit";
// const { seed } = require("./seed");

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    // await seed();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
  });