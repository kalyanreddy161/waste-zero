const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { notify } = require("./notificationService");

const shapeConversation = (conversation, otherUser) => ({
  _id: conversation._id,
  type: "direct",
  name: otherUser ? otherUser.fullName : "Unknown",
  username: otherUser ? otherUser.username : "",
  otherUserId: otherUser ? otherUser._id : null,
  lastMessage: conversation.lastMessage || { content: "" },
  updatedAt: conversation.updatedAt || new Date().toISOString(),
});

async function sendDirectSystemMessage({
  senderId,
  receiverId,
  content,
  preview,
  notificationSubject,
  silentSender = false,
  notifyReceiver = true,
}) {
  const fromId = String(senderId);
  const toId = String(receiverId);
  const text = String(content || "").trim();
  const previewText = String(preview || text).trim() || text;

  if (!fromId || !toId || !text) {
    throw new Error("senderId, receiverId, and content are required");
  }

  let conversation = await Conversation.findOne({
    type: "direct",
    participants: { $all: [fromId, toId], $size: 2 },
  });

  const [sender, receiver] = await Promise.all([
    User.findById(fromId).select("fullName username").lean(),
    User.findById(toId).select("fullName username").lean(),
  ]);

  let createdConversation = false;
  if (!conversation) {
    conversation = await Conversation.create({
      type: "direct",
      participants: [fromId, toId],
      lastMessage: { content: "", timestamp: null },
    });
    createdConversation = true;
  }

  const message = await Message.create({
    conversationId: conversation._id,
    sender_id: fromId,
    receiver_id: toId,
    content: text,
    attachments: [],
    status: "sent",
    timestamp: new Date(),
  });

  await Conversation.findByIdAndUpdate(conversation._id, {
    lastMessage: {
      content: previewText,
      senderId: fromId,
      type: "text",
      timestamp: message.timestamp,
    },
    updatedAt: new Date(),
  });
  conversation.lastMessage = {
    content: previewText,
    senderId: fromId,
    type: "text",
    timestamp: message.timestamp,
  };
  conversation.updatedAt = message.timestamp;

  const populatedMessage = await Message.findById(message._id)
    .populate("sender_id", "fullName username")
    .lean();

  const receiverPresence =
    (global.presence && global.presence.get(toId)) || "offline";
  const receiverOnline = Boolean(
    global.onlineUsers &&
    global.onlineUsers.has(toId) &&
    global.onlineUsers.get(toId).size > 0
  );
  const receiverViewingMessages = Boolean(
    global.inMessagesUsers &&
    global.inMessagesUsers.has(toId) &&
    receiverPresence === "active"
  );

  if (receiverOnline && receiverPresence === "active") {
    await Message.findByIdAndUpdate(message._id, { status: "delivered" });
    if (global.io && !silentSender) {
      global.io.to(fromId).emit("message-status", {
        messageId: message._id,
        status: "delivered",
      });
    }
  }

  if (global.io) {
    if (createdConversation) {
      global.io.to(toId).emit("conversation-created", {
        conversation: shapeConversation(conversation, sender),
      });
      if (!silentSender) {
        global.io.to(fromId).emit("conversation-created", {
          conversation: shapeConversation(conversation, receiver),
        });
      }
    }

    global.io.to(toId).emit("receive-message", populatedMessage);
    if (!silentSender) {
      global.io.to(fromId).emit("receive-message", populatedMessage);
    }
  }

  if (notifyReceiver && !receiverViewingMessages) {
    await notify({
      io: global.io,
      receiverId: toId,
      senderId: fromId,
      type: "message",
      referenceId: message._id,
      conversationId: conversation._id,
      meta: {
        senderName: sender ? sender.fullName : "WasteZero Admin",
        message: text,
        messageSubject: notificationSubject || undefined,
        conversationId: String(conversation._id),
      },
    });
  }

  return {
    conversationId: conversation._id,
    message: populatedMessage,
  };
}

module.exports = {
  sendDirectSystemMessage,
};
