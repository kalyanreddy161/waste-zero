const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const authRoutes = require("./routes/RegisterRoutes");
const profileRoutes = require("./routes/ProfileRoutes");
const opportunitiesRoutes = require("./routes/OpportunitiesRoutes");
const applicationRoutes = require("./routes/ApplicationRoutes");
const notificationRoutes = require("./routes/NotificationRoutes");
const uploadRoutes = require("./routes/UploadRoutes");
const messageRoutes = require("./routes/MessageRoutes"); // ← NEW

// Chat models used directly in the socket handler
const Message = require("./models/Message");         // ← NEW
const Conversation = require("./models/Conversation"); // ← NEW
const User = require("./models/User");
const { runModerationExpirySweep } = require("./services/moderationStatusService");

const app = express();
const MODERATION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/* ======================
   MIDDLEWARE
====================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["https://waste-zero-sigma.vercel.app", "http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

/* ======================
   DATABASE
====================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

/* ======================
   SESSION STORE
====================== */
const store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: "mySession",
});

store.on("error", (error) => {
  console.error("SESSION STORE ERROR:", error);
});

/* ======================
   SESSION MIDDLEWARE
====================== */
app.set("trust proxy", 1); 
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "secret123",
  resave: false,
  saveUninitialized: false,
  store: store,
    cookie: {
    httpOnly: true,
    secure: isProduction,          // ✅ only true in production
    sameSite: isProduction ? "none" : "lax",  // ✅ important
    maxAge: process.env.SESSION_MAX_AGE
      ? parseInt(process.env.SESSION_MAX_AGE, 10)
      : 7 * 24 * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);

/* ======================
   ROUTES
====================== */
app.use("/auth", authRoutes);
app.use("/", profileRoutes);
app.use("/", opportunitiesRoutes);
app.use(applicationRoutes);
app.use(notificationRoutes);
app.use("/api", uploadRoutes);
app.use("/api/chat", messageRoutes); // ← NEW: all chat REST endpoints
// Push subscription endpoints
app.use('/api/push', require('./routes/PushRoutes'));
app.use('/pickup', require('./routes/ScheduleRoutes'));

/* ======================
   HTTP SERVER + SOCKET.IO
====================== */
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://waste-zero-sigma.vercel.app","http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  },
});

// Share the session middleware with Socket.IO so we can read req.session.user
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Auth guard — reject sockets that don't have a valid session
io.use((socket, next) => {
  const req = socket.request;

  if (
    req.session &&
    req.session.isAuthenticated &&
    req.session.user &&
    req.session.user.id
  ) {
    return next();
  }

  return next(new Error("unauthorized"));
});

/* ─────────────────────────────────────────────
   ONLINE USER TRACKING
   Map<userId (string), Set<socketId (string)>>

   Multiple browser tabs / devices per user are supported.
   When ALL sockets for a user disconnect, they are marked offline.
───────────────────────────────────────────── */
const onlineUsers = new Map(); // userId → Set of socketIds
// Track users who currently have the Messages page open
const inMessagesUsers = new Set(); // userId strings
// Presence map tracks active | inactive | offline per user
const presence = new Map();

// expose presence and onlineUsers for services
global.presence = presence;
global.onlineUsers = onlineUsers;
global.inMessagesUsers = inMessagesUsers;

function markOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function markOffline(userId, socketId) {
  if (onlineUsers.has(userId)) {
    onlineUsers.get(userId).delete(socketId);
    if (onlineUsers.get(userId).size === 0) onlineUsers.delete(userId);
  }
}

function isOnline(userId) {
  return onlineUsers.has(String(userId)) && onlineUsers.get(String(userId)).size > 0;
}

/* ─────────────────────────────────────────────
   SOCKET CONNECTION HANDLER
───────────────────────────────────────────── */
io.on("connection", (socket) => {
  try {
    const req = socket.request;
    const userId = String(req.session.user.id);

    /* ── Join personal room (for targeted delivery) ── */
    socket.join(userId);

    // Presence: whether this user currently has the Messages page open
    socket.on("presence:in-messages", (val) => {
      try {
        if (val) inMessagesUsers.add(String(userId));
        else inMessagesUsers.delete(String(userId));
      } catch (e) { }
    });

    // Visibility / activity events from client
    socket.on('user_active', () => {
      try { presence.set(String(userId), 'active'); } catch (e) { }
    });

    socket.on('user_inactive', () => {
      try { presence.set(String(userId), 'inactive'); } catch (e) { }
    });

    /* ── Track online presence ── */
    markOnline(userId, socket.id);
    // default to active when a socket connects
    try { presence.set(String(userId), 'active'); } catch (e) { }
    console.log(`[socket] connected: user=${userId} socket=${socket.id}`);

    // Broadcast online status to everyone so chat lists can show the green dot
    io.emit("user-online", { userId });

    /* ── Deliver any undelivered messages immediately on connect ── */
    (async () => {
      try {
        const undelivered = await Message.find({
          receiver_id: userId,
          status: "sent",
        });
        for (const msg of undelivered) {
          const populated = await Message.findById(msg._id)
            .populate("sender_id", "fullName username")
            .lean();
          // Deliver to the newly-connected socket
          socket.emit("receive-message", populated);
          // Update status to delivered
          await Message.findByIdAndUpdate(msg._id, { status: "delivered" });
          // Notify sender their message was delivered
          io.to(String(msg.sender_id)).emit("message-status", {
            messageId: msg._id,
            status: "delivered",
          });
        }
      } catch (e) {
        console.error("[socket] undelivered message delivery error:", e);
      }
    })();

    /* ════════════════════════════════════════════════
       EVENT: send-message
       Payload:
         { conversationId, content, attachments?: [], receiverId? }

       Flow:
       1. Save Message to DB with status "sent".
       2. Update Conversation.lastMessage snapshot.
       3. Emit to sender (for multi-tab sync).
       4. If receiver is online → emit "receive-message" + update to "delivered".
       5. If receiver is offline → message stays "sent" and will be delivered on reconnect.
    ════════════════════════════════════════════════ */
    socket.on("send-message", async (data, ack) => {
      try {
        let { conversationId, content, attachments = [], receiverId } = data;

        // If no conversationId was provided (UI opened a temporary DM), try to
        // find an existing direct conversation between the two users or create
        // a new direct conversation now. This prevents creating empty DB rows
        // until the first message is actually sent.
        if (!conversationId) {
          if (!receiverId) {
            if (ack) ack({ error: "conversationId or receiverId required" });
            return;
          }

          // Normalize ids as strings
          const rId = String(receiverId);
          const uId = String(userId);

          // Try to find an existing direct convo between these two users
          let found = await Conversation.findOne({
            type: "direct",
            participants: { $all: [uId, rId] },
          });

          let createdNewConversation = false;
          if (!found) {
            found = await Conversation.create({
              type: "direct",
              participants: [uId, rId],
              lastMessage: { content: "", timestamp: null },
            });
            createdNewConversation = true;
          }

          conversationId = String(found._id);

          // If we created a new conversation, notify the receiver so their
          // conversations list can update immediately (if online).
          if (createdNewConversation) {
            try {
              // Populate sender info so the recipient sees the sender's name immediately
              const sender = await User.findById(uId).select("fullName username").lean();
              const shaped = {
                _id: found._id,
                type: "direct",
                name: sender ? sender.fullName : "",
                username: sender ? sender.username : "",
                otherUserId: uId,
                lastMessage: found.lastMessage || { content: "" },
                updatedAt: found.updatedAt || new Date().toISOString(),
              };
              // notify the receiver's personal room
              io.to(rId).emit("conversation-created", { conversation: shaped });
            } catch (e) {
              console.error("emit conversation-created error:", e);
            }
          }
        }

        // Verify the sender is actually a participant in this conversation
        const conv = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });
        if (!conv) {
          if (ack) ack({ error: "Forbidden" });
          return;
        }

        // Build and save the message
        const msg = await Message.create({
          conversationId,
          sender_id: userId,
          receiver_id: receiverId || null,
          content: content || "",
          attachments,
          status: "sent",
          timestamp: new Date(),
        });

        // Update the conversation's lastMessage snapshot and updatedAt
        const preview =
          attachments.length > 0
            ? attachments[0].type === "image"
              ? "📷 Photo"
              : attachments[0].type === "audio"
                ? "🎵 Audio"
                : `📄 ${attachments[0].fileName || "File"}`
            : content || "";

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: {
            content: preview,
            senderId: userId,
            type: attachments.length > 0 ? attachments[0].type : "text",
            timestamp: msg.timestamp,
          },
          updatedAt: new Date(),
        });

        // Populate sender info for the response
        const populated = await Message.findById(msg._id)
          .populate("sender_id", "fullName username")
          .lean();

        // Acknowledge back to sender (optimistic update confirmation)
        if (ack) ack({ message: populated, conversationId });

        // Reflect in sender's other tabs (if multi-tab)
        socket.to(userId).emit("receive-message", populated);

        /* Direct message delivery: deliver to the receiver (other participant)
           Note: groups have been removed; conversations are direct only. */
        try {
          const receiverIdStr = String(receiverId);
          const pres = (global && global.presence && global.presence.get(String(receiverIdStr))) || 'offline';
          const receiverIsViewing = inMessagesUsers.has(receiverIdStr) && pres === 'active';

          if (isOnline(receiverIdStr) && pres === 'active') {
            io.to(receiverIdStr).emit("receive-message", populated);
            await Message.findByIdAndUpdate(msg._id, { status: "delivered" });
            socket.emit("message-status", { messageId: msg._id, status: "delivered" });
          }

          if (!receiverIsViewing) {
            try {
              const sendNotification = require("./utils/sendNotification");
              const sender = await User.findById(userId).select("fullName username").lean();
              await sendNotification({
                io,
                receiverId: receiverIdStr,
                senderId: userId,
                type: "message",
                referenceId: msg._id,
                conversationId: conversationId,
                meta: { senderName: sender ? sender.fullName : "", message: content || "" },
              });
            } catch (e) {
              console.error("sendNotification (message) error:", e);
            }
          }
        } catch (e) { console.error("message delivery error:", e); }
      } catch (err) {
        console.error("[socket] send-message error:", err);
        if (ack) ack({ error: "Server error" });
      }
    });

    /* ════════════════════════════════════════════════
       EVENT: message-seen
       Payload: { conversationId }
       Mark all messages in this conversation (sent by others) as "seen".
    ════════════════════════════════════════════════ */
    socket.on("message-seen", async ({ conversationId }) => {
      try {
        if (!conversationId) return;

        // Find messages in this conv NOT sent by me that aren't yet seen
        const unseenMsgs = await Message.find({
          conversationId,
          sender_id: { $ne: userId },
          status: { $in: ["sent", "delivered"] },
        }).select("_id sender_id");

        if (unseenMsgs.length === 0) return;

        const ids = unseenMsgs.map((m) => m._id);
        await Message.updateMany({ _id: { $in: ids } }, { status: "seen" });

        // Group by sender so we notify each sender only once
        const senderIds = [...new Set(unseenMsgs.map((m) => String(m.sender_id)))];
        for (const senderId of senderIds) {
          const senderMsgIds = unseenMsgs
            .filter((m) => String(m.sender_id) === senderId)
            .map((m) => m._id);

          io.to(senderId).emit("messages-seen", {
            conversationId,
            messageIds: senderMsgIds,
          });
        }
      } catch (err) {
        console.error("[socket] message-seen error:", err);
      }
    });

    /* ════════════════════════════════════════════════
       EVENT: delete-message
       Payload: { messageId, conversationId }
       Only the sender can delete their own message.
    ════════════════════════════════════════════════ */
    socket.on("delete-message", async ({ messageId, conversationId }, ack) => {
      try {
        const msg = await Message.findOne({ _id: messageId, sender_id: userId });
        if (!msg) {
          if (ack) ack({ error: "Message not found or forbidden" });
          return;
        }

        await Message.findByIdAndDelete(messageId);

        // Refresh lastMessage on the conversation
        const lastMsg = await Message.findOne({ conversationId })
          .sort({ timestamp: -1 })
          .lean();

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: lastMsg
            ? {
              content: lastMsg.content || (lastMsg.attachments[0]?.type === "image" ? "📷 Photo" : "📄 File"),
              senderId: lastMsg.sender_id,
              type: lastMsg.attachments.length ? lastMsg.attachments[0].type : "text",
              timestamp: lastMsg.timestamp,
            }
            : { content: "", timestamp: null },
        });

        if (ack) ack({ success: true });

        // Notify all participants in the conversation to remove the message
        const conv = await Conversation.findById(conversationId);
        if (conv) {
          for (const participantId of conv.participants) {
            io.to(String(participantId)).emit("message-deleted", { messageId, conversationId });
          }
        }
      } catch (err) {
        console.error("[socket] delete-message error:", err);
        if (ack) ack({ error: "Server error" });
      }
    });

    /* ════════════════════════════════════════════════
       TYPING INDICATORS  (never stored in DB)
       Events: typing, stop-typing
       Payload: { conversationId, receiverId? }
    ════════════════════════════════════════════════ */
    socket.on("typing", async ({ conversationId, receiverId }) => {
      try {
        const conv = await Conversation.findById(conversationId);
        if (!conv) return;

        if (receiverId) {
          io.to(String(receiverId)).emit("typing", { conversationId, userId });
        }
      } catch (e) { /* ignore */ }
    });

    socket.on("stop-typing", async ({ conversationId, receiverId }) => {
      try {
        const conv = await Conversation.findById(conversationId);
        if (!conv) return;

        if (receiverId) {
          io.to(String(receiverId)).emit("stop-typing", { conversationId, userId });
        }
      } catch (e) { /* ignore */ }
    });

    // Group rooms removed — no group socket rooms to manage.

    /* ════════════════════════════════════════════════
       DISCONNECT
    ════════════════════════════════════════════════ */
    socket.on("disconnect", () => {
      markOffline(userId, socket.id);
      // remove presence flag
      inMessagesUsers.delete(String(userId));

      if (!isOnline(userId)) {
        try { presence.set(String(userId), 'offline'); } catch (e) { }
        io.emit("user-offline", { userId });
        console.log(`[socket] user offline: ${userId}`);
      }
      console.log(`[socket] disconnected: socket=${socket.id}`);
    });
  } catch (err) {
    console.error("[socket] connection handler error:", err);
  }
});

/* expose io globally so other controllers can emit events */
global.io = io;

let moderationSweepTimer = null;
const runModerationSweep = async () => {
  try {
    await runModerationExpirySweep();
  } catch (error) {
    console.error("[moderation-sweep] error:", error);
  }
};

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  runModerationSweep();
  moderationSweepTimer = setInterval(runModerationSweep, MODERATION_SWEEP_INTERVAL_MS);
});

server.on("close", () => {
  if (moderationSweepTimer) {
    clearInterval(moderationSweepTimer);
  }
});
