process.on('uncaughtException', err => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on('unhandledRejection', err => {
  console.error("UNHANDLED PROMISE REJECTION:", err);
});
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./routes/RegisterRoutes");
const pickupRoutes = require("./routes/pickupRoutes");


const app = express();

/* ======================
   MIDDLEWARE
====================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

/* ======================
   ROUTES
====================== */
app.use("/auth", authRoutes);
app.use("/api/pickups", pickupRoutes);


/* ======================
   CONNECT DB & START SERVER
====================== */
const PORT = process.env.PORT || 3000;

// Start server FIRST
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Then try MongoDB (optional for now)
mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection failed:", err));


