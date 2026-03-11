const express = require("express");
const router = express.Router();
const Pickup = require("../models/Pickup");

/* ======================
   CREATE PICKUP REQUEST
====================== */
router.post("/schedule", async (req, res) => {
  try {
    const pickup = new Pickup(req.body);

    await pickup.save();

    res.status(201).json({
      message: "Pickup scheduled successfully",
      pickup: pickup
    });

  } catch (error) {
    console.error("Pickup scheduling error:", error);

    res.status(500).json({
      message: "Error scheduling pickup"
    });
  }
});

/* ======================
   GET ALL PICKUPS
   (for admin dashboard)
====================== */
router.get("/", async (req, res) => {
  try {
    const pickups = await Pickup.find().sort({ createdAt: -1 });

    res.json(pickups);

  } catch (error) {
    console.error("Error fetching pickups:", error);

    res.status(500).json({
      message: "Error fetching pickups"
    });
  }
});

module.exports = router;