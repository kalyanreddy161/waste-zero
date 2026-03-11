/**
 * Message Model
 *
 * Purpose: Stores every individual chat message.
 *
 * - conversationId → ties the message to its Conversation document.
 * - sender_id      → who sent the message (User._id).
 * - receiver_id    → direct-chat only (null for group messages).
 * - content        → plain text body (empty string for media-only messages).
 * - attachments    → array of uploaded files (images / audio / documents).
 *                    Each attachment contains the ImageKit URL, file name, and size.
 * - status         → delivery lifecycle: sent → delivered → seen.
 *                    Only tracked on direct messages; group messages stay "sent".
 * - timestamp      → explicit message time used for pagination cursor (cursor-based pagination).
 *
 * Indexes:
 *  - { conversationId, timestamp } compound index enables efficient paginated
 *    fetches: "give me the 20 messages before timestamp X in conversation Y".
 */

const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["image", "audio", "file"],
            required: true,
        },
        url: { type: String, required: true },   // ImageKit CDN URL
        fileName: { type: String, default: "" },
        size: { type: Number, default: 0 },       // bytes
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
        },

        sender_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // receiver_id is populated for direct messages (null for group)
        receiver_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        content: {
            type: String,
            default: "",
        },

        attachments: {
            type: [attachmentSchema],
            default: [],
        },

        status: {
            type: String,
            enum: ["sent", "delivered", "seen"],
            default: "sent",
        },

        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: false } // we use our own `timestamp` field for cursor pagination
);

// Compound index used in paginated message fetches
messageSchema.index({ conversationId: 1, timestamp: -1 });

module.exports = mongoose.model("Message", messageSchema);
