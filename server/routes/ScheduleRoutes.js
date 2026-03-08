const express = require("express");
const router = express.Router();
const { createPickup, getMyPickups } = require("../controllers/ScheduleController");

router.post("/schedule", createPickup);
router.get("/mypickups", getMyPickups);

module.exports = router;
