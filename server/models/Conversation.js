/**
 * Conversation Model
 *
 * Purpose: Represents a chat session between two users (direct) or a group.
 * - type "direct" = one-to-one DM, participants has exactly 2 user IDs.
 * - type "group"  = multi-user group chat linked to a Group doc and optionally an Opportunity.
 * - lastMessage   = denormalized last message snapshot for the chat list (avoids expensive joins).
 * - updatedAt     = used to sort conversations by recency in the chat list.
 */

const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["direct"],
            required: true,
        },

        // All participant user IDs (for both direct and group)
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        // groupId removed — group chats are deprecated

        // Snapshot of the last message so the chat list doesn't need an extra query
        lastMessage: {
            content: { type: String, default: "" },
            senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            type: { type: String, default: "text" }, // text | image | audio | file
            timestamp: { type: Date },
        },
    },
    { timestamps: true } // createdAt + updatedAt; updatedAt updated on every message
);

// Index for fast chat list queries: find all conversations a user participates in,
// sorted by most recent.
conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);
