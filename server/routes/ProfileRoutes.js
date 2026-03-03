const express = require("express");
const router = express.Router();
const checkAuth = require("../middlewares/CheckAuth");
const ProfileController = require("../controllers/ProfileController");

// Update profile details (name, skills, bio, location)
router.put("/profile", checkAuth, ProfileController.updateProfile);

// Send OTP to a new email address when user wants to update email (does NOT change saved email)
router.post("/profile/send-otp-update", checkAuth, ProfileController.sendOTPForUpdate);

// Update email after OTP verification. Use /auth/send-otp and OTP verification flow.
router.put("/profile/email", checkAuth, ProfileController.updateEmail);

// Change password (hashed)
router.put("/profile/password", checkAuth, ProfileController.changePassword);

// Get current user (sanitized)
router.get("/me", checkAuth, ProfileController.getMe);


module.exports = router;

