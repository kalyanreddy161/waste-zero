const express = require("express");
const router = express.Router();
const checkAuth = require("../middlewares/CheckAuth");
const requireAdmin = require("../middlewares/RequireAdmin");
const ProfileController = require("../controllers/ProfileController");
const AdminController = require("../controllers/AdminController");
const FeedbackController = require("../controllers/FeedbackController");

// Update profile details (name, skills, bio, location)
router.put("/profile", checkAuth, ProfileController.updateProfile);

// Send OTP to a new email address when user wants to update email (does NOT change saved email)
router.post("/profile/send-otp-update", checkAuth, ProfileController.sendOTPForUpdate);

// Update email after OTP verification. Use /auth/send-otp and OTP verification flow.
router.put("/profile/email", checkAuth, ProfileController.updateEmail);

// Change password (hashed)
router.put("/profile/password", checkAuth, ProfileController.changePassword);
router.delete("/profile/account", checkAuth, ProfileController.deleteAccount);

// Get current user (sanitized)
router.get("/me", checkAuth, ProfileController.getMe);

// Help & Support feedback
router.post("/feedback", checkAuth, FeedbackController.submitFeedback);
router.get("/feedback", checkAuth, requireAdmin, FeedbackController.getFeedback);

// Admin-only analytics and moderation
router.get("/admin/dashboard", checkAuth, requireAdmin, AdminController.getDashboardAnalytics);
router.get("/admin/overview", checkAuth, requireAdmin, AdminController.getAdminOverview);
router.post("/admin/users/:id/restrict", checkAuth, requireAdmin, AdminController.restrictUser);
router.post("/admin/users/:id/suspend", checkAuth, requireAdmin, AdminController.suspendUser);
router.post("/admin/users/:id/restore", checkAuth, requireAdmin, AdminController.restoreUser);
router.post("/admin/opportunities/:id/moderate", checkAuth, requireAdmin, AdminController.moderateOpportunityOwner);


module.exports = router;

