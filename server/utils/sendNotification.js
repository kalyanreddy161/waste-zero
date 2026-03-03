const Notification = require("../models/Notification");

/**
 * sendNotification saves a notification and emits realtime event via socket.io
 *
 * @param {Object} params
 * @param {import('socket.io').Server} params.io - socket.io server instance (optional; will fall back to global.io)
 * @param {ObjectId} params.receiverId - user id who will receive the notification
 * @param {ObjectId} params.senderId - user id who triggered the notification
 * @param {String} params.type - one of application|accepted|rejected|message
 * @param {ObjectId} params.referenceId - optional reference id (application, message etc)
 */
async function sendNotification({ io, receiverId, senderId, type, referenceId, application_id }) {
  try {
    const notif = new Notification({ receiverId, senderId, type, referenceId, application_id });
    const saved = await notif.save();

    // prefer passed io, otherwise global.io (set in server.js)
    const socketServer = io || global.io;

    const payload = {
      id: saved._id,
      receiverId: String(saved.receiverId),
      senderId: saved.senderId ? String(saved.senderId) : null,
      type: saved.type,
      referenceId: saved.referenceId ? String(saved.referenceId) : null,
      application_id: saved.application_id ? String(saved.application_id) : null,
      read: saved.read,
      createdAt: saved.createdAt,
    };

    if (socketServer && receiverId) {
      // emit generic notification event
      // clients should listen to "notification" and filter by payload.type if needed
      socketServer.to(String(receiverId)).emit("notification", payload);
    }

    return saved;
  } catch (err) {
    console.error("sendNotification error:", err);
    throw err;
  }
}

module.exports = sendNotification;
