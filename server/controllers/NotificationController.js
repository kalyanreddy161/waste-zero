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

const clearChatNotifications = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ message: "conversationId required" });

    const Message = require('../models/Message');
    // find messages in this conversation
    const msgs = await Message.find({ conversationId }).select('_id').lean();
    const ids = msgs.map(m => m._id);
    if (ids.length === 0) return res.json({ deleted: 0 });

    const result = await Notification.deleteMany({ receiverId: userId, type: 'message', referenceId: { $in: ids } });
    return res.json({ deleted: result.deletedCount || 0 });
  } catch (err) {
    console.error('clearChatNotifications error:', err);
    return res.status(500).json({ message: 'Failed to clear notifications' });
  }
};

module.exports = { getNotifications, getUnreadCount, markRead, clearChatNotifications };
