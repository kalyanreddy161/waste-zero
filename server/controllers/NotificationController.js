const Notification = require("../models/Notification");

const getNotifications = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const notifications = await Notification.find({ receiverId: userId }).sort({ createdAt: -1 }).limit(100);
    return res.json(notifications);
  } catch (err) {
    console.error("getNotifications error:", err);
    return res.status(500).json({ message: "Failed to load notifications" });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const count = await Notification.countDocuments({ receiverId: userId, read: false });
    return res.json({ unread: count });
  } catch (err) {
    console.error("getUnreadCount error:", err);
    return res.status(500).json({ message: "Failed to count unread notifications" });
  }
};

const markRead = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const notif = await Notification.findById(id);
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    if (String(notif.receiverId) !== String(userId)) return res.status(403).json({ message: "Forbidden" });

    // delete notification when marked as read (per UI behavior)
    await Notification.deleteOne({ _id: id });
    return res.json({ message: "Deleted notification" });
  } catch (err) {
    console.error("markRead error:", err);
    return res.status(500).json({ message: "Failed to mark notification" });
  }
};

module.exports = { getNotifications, getUnreadCount, markRead };
