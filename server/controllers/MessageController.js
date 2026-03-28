/**
 * MessageController
 *
 * Handles HTTP endpoints for:
 *   1. GET  /conversations          — list all conversations for the logged-in user
 *   2. POST /conversations/direct   — find or create a direct conversation with another user
 *   3. GET  /messages               — paginated messages for a conversation
 *   4. GET  /users/search           — search users by username (for "new chat" search panel)

 * Socket-based message sending/deletion is handled inside server.js socket handler,
 * so there is no POST /messages route — that comes through the socket.
 */

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const Application = require("../models/Application");
const Opportunity = require("../models/Opportunities");

/* ─────────────────────────────────────────────
   1. GET /conversations
   Returns the chat list for the logged-in user.
   Populated with the other participant's name/username
   (or group name for group chats), plus the lastMessage snapshot.
───────────────────────────────────────────── */
exports.getConversations = async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Find all conversations where this user is a participant,
        // sorted by most recently active (updatedAt DESC)
        const conversations = await Conversation.find({ participants: userId })
            .sort({ updatedAt: -1 })
            .populate("participants", "fullName username")
                .lean();

        // Shape the data for the frontend chat list
        const shaped = conversations.map((conv) => {
            if (conv.type === "direct") {
                // Find the participant who is NOT the current user
                const other = conv.participants.find(
                    (p) => String(p._id) !== String(userId)
                );
                return {
                    _id: conv._id,
                    type: "direct",
                    name: other ? other.fullName : "Unknown",
                    username: other ? other.username : "",
                    otherUserId: other ? other._id : null,
                    lastMessage: conv.lastMessage,
                    updatedAt: conv.updatedAt,
                };
            }
        });

        res.json(shaped);
    } catch (err) {
        console.error("getConversations error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

/* ─────────────────────────────────────────────
   2. POST /conversations/direct
   Body: { otherUserId }

   Find an existing direct conversation between the two users,
   or create one if it doesn't exist.
   Returns the conversation document.
───────────────────────────────────────────── */
exports.getOrCreateDirectConversation = async (req, res) => {
    try {
        const myId = req.session.user.id;
        const { otherUserId } = req.body;

        if (!otherUserId) {
            return res.status(400).json({ message: "otherUserId is required" });
        }

        if (String(myId) === String(otherUserId)) {
            return res.status(400).json({ message: "Cannot chat with yourself" });
        }

        // Search for an existing direct conversation that has both users as participants
        let conv = await Conversation.findOne({
            type: "direct",
            participants: { $all: [myId, otherUserId], $size: 2 },
        });

        if (!conv) {
            conv = await Conversation.create({
                type: "direct",
                participants: [myId, otherUserId],
            });
        }

        res.json({ conversationId: conv._id });
    } catch (err) {
        console.error("getOrCreateDirectConversation error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

/* ─────────────────────────────────────────────
   3. GET /messages?conversationId=X&limit=20&cursor=ISO_TIMESTAMP
   Cursor-based pagination: returns `limit` messages OLDER than `cursor`.
   If cursor is omitted, returns the latest `limit` messages.

   Compound index { conversationId, timestamp } makes this O(log n).
───────────────────────────────────────────── */
exports.getMessages = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { conversationId } = req.query;

        if (!conversationId) {
            return res.status(400).json({ message: "conversationId is required" });
        }

        const conv = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
        });

        if (!conv) {
            return res.status(403).json({ message: "Access denied" });
        }

        const messages = await Message.find({ conversationId })
            .sort({ timestamp: 1 }) // oldest → newest
            .populate("sender_id", "fullName username")
            .lean();

        res.json(messages);
    } catch (err) {
        console.error("getMessages error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

    /* ─────────────────────────────────────────────
       GET /messages/:id
       Return a single message by id (populated with sender info).
    ───────────────────────────────────────────── */
    exports.getMessageById = async (req, res) => {
        try {
            const userId = req.session.user.id;
            const { id } = req.params;
            if (!id) return res.status(400).json({ message: "message id required" });

            const msg = await Message.findById(id).populate("sender_id", "fullName username").lean();
            if (!msg) return res.status(404).json({ message: "Message not found" });

            // Verify user is participant in the conversation
            const conv = await Conversation.findOne({ _id: msg.conversationId, participants: userId });
            if (!conv) return res.status(403).json({ message: "Access denied" });

            res.json(msg);
        } catch (err) {
            console.error("getMessageById error:", err);
            res.status(500).json({ message: "Server error" });
        }
    };
/* ─────────────────────────────────────────────
   4. GET /users/search?q=username
   Searches users by username prefix (case-insensitive).
   Excludes the currently logged-in user.
   Returns: [{ _id, fullName, username, role }]
───────────────────────────────────────────── */
exports.searchUsers = async (req, res) => {
    try {
        const myId = req.session.user.id;
        const myRole = req.session.user.role;
        const { q } = req.query;

        if (myRole === "admin") {
            return res.json([]);
        }

        if (!q || q.trim().length < 1) {
            return res.json([]);
        }

        const users = await User.find({
            _id: { $ne: myId },
            username: { $regex: q.trim(), $options: "i" },
            isProfileCompleted: true,
        })
            .select("fullName username role")
            .limit(15)
            .lean();

        res.json(users);
    } catch (err) {
        console.error("searchUsers error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Group-related endpoints removed — group chat feature deprecated.
