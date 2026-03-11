/**
 * MessageRoutes
 *
 * All routes are protected by the existing checkAuth middleware.
 * Base prefixes are mounted in server.js under "/api/chat".
 *
 * Routes:
 *   GET  /api/chat/conversations          → list user's conversations
 *   POST /api/chat/conversations/direct   → get/create DM conversation
 *   GET  /api/chat/messages               → paginated messages (cursor-based)
 *   GET  /api/chat/users/search           → search users by username
 *   POST /api/chat/groups                 → create group (NGO only)
 *   POST /api/chat/groups/:groupId/join   → join group (accepted volunteers)
 */

const express = require("express");
const router = express.Router();
const checkAuth = require("../middlewares/CheckAuth");
const multer = require("multer");
const imagekit = require("../services/ImageKitService");
const {
    getConversations,
    getOrCreateDirectConversation,
    getMessages,
    getMessageById,
    searchUsers,
} = require("../controllers/MessageController");

// All chat routes require authentication
router.use(checkAuth);

router.get("/conversations", getConversations);
router.post("/conversations/direct", getOrCreateDirectConversation);
router.get("/messages", getMessages);
router.get("/messages/:id", getMessageById);
router.get("/users/search", searchUsers);
// Group endpoints removed — group chat feature deprecated.

/* ─────────────────────────────────────────────
   File Upload for Chat Attachments
   POST /api/chat/upload
   Accepts a single file field named "file".
   Allowed: jpg, png, webp, mp3, pdf, doc, docx, zip
   Max size: 10 MB
   Returns: { url, fileName, fileType, size }
───────────────────────────────────────────── */
const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "audio/mpeg",      // mp3
    "audio/mp3",       // alternate mp3 MIME
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type not allowed: ${file.mimetype}`));
        }
    },
});

router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const { originalname, buffer, mimetype, size } = req.file;

        // Determine attachment type for the Message model
        let attachmentType = "file";
        if (mimetype.startsWith("image/")) attachmentType = "image";
        else if (mimetype === "audio/mpeg" || mimetype === "audio/mp3") attachmentType = "audio";

        const folder = `/chat/${attachmentType}s`;
        const response = await imagekit.upload({
            file: buffer,
            fileName: `${Date.now()}-${originalname}`,
            folder,
        });

        res.json({
            url: response.url,
            fileName: originalname,
            fileType: attachmentType,
            size,
        });
    } catch (err) {
        console.error("chat upload error:", err);
        res.status(500).json({ message: err.message || "Upload failed" });
    }
});

module.exports = router;
