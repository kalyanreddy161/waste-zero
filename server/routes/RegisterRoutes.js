const express = require("express");
const router = express.Router();

const {
  register,
  login,
  logout,
  existUsername,
  existEmail,
  sendOTP,
  verifyOTP,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetForgotPassword,
} = require("../controllers/RegisterController");

const checkAuth = require("../middlewares/CheckAuth");

router.post("/exist-username", existUsername);
router.post("/send-otp", sendOTP);
router.post("/exist-email", existEmail);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password/send-otp", sendForgotPasswordOTP);
router.post("/forgot-password/verify-otp", verifyForgotPasswordOTP);
router.post("/forgot-password/reset", resetForgotPassword);
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// 🔐 Protected route example (renamed to /home)
router.get("/home", checkAuth, (req, res) => {
  res.status(200).json({
    message: "Welcome to home",
    user: req.session.user
  });
});

module.exports = router;
