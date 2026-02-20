const express = require("express");
const router = express.Router();
const Pickup = require("../models/Pickup");

// Create Pickup Request
router.post("/schedule", async (req, res) => {
  try {
    const pickup = new Pickup(req.body);
    await pickup.save();

    res.status(201).json({
      message: "Pickup scheduled successfully",
      pickup: pickup
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error scheduling pickup"
    });
  }
});

// Get all pickups (for admin panel later)
router.get("/", async (req, res) => {
  try {
    const pickups = await Pickup.find().sort({ createdAt: -1 });
    res.json(pickups);
  } catch (error) {
    res.status(500).json({ message: "Error fetching pickups" });
  }
});

module.exports = router;
