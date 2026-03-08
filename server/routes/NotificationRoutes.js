const express = require("express");
const router = express.Router();
const checkAuth = require("../middlewares/CheckAuth");
const NotificationController = require("../controllers/NotificationController");

router.get("/notifications", checkAuth, NotificationController.getNotifications);
router.get("/notifications/unread-count", checkAuth, NotificationController.getUnreadCount);
router.put("/notifications/:id/read", checkAuth, NotificationController.markRead);

module.exports = router;
