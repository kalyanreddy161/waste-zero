const express = require("express");
const router = express.Router();
const multer = require("multer");
const { uploadImage } = require("../controllers/UploadController");
const checkAuth = require("../middlewares/CheckAuth");

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/upload", checkAuth, upload.single("image"), uploadImage);

module.exports = router;
