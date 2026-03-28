const express = require("express");
const router = express.Router();
const checkAuth = require("../middlewares/CheckAuth");
const {
  createPickup,
  getPickups,
  acceptPickup,
  completePickup,
  updatePickup,
  deletePickup,
  getPickupStats,
  reportPickupUserToAdmin,
} = require("../controllers/ScheduleController");

router.use(checkAuth);

router.post("/", createPickup);
router.get("/", getPickups);
router.get("/stats", getPickupStats);
router.put("/:id/accept", acceptPickup);
router.put("/:id/complete", completePickup);
router.post("/:id/report", reportPickupUserToAdmin);
router.put("/:id", updatePickup);
router.delete("/:id", deletePickup);

module.exports = router;
