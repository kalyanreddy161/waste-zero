const express = require("express");
const router = express.Router();

const {
  register,
  login,
  logout,
  existUsername,
  existEmail
} = require("../controllers/RegisterController");

const checkAuth = require("../middlewares/CheckAuth");

router.post("/exist-username", existUsername);
router.post("/exist-email", existEmail);
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// 🔐 Protected route example
router.get("/dashboard", checkAuth, (req, res) => {
  res.status(200).json({
    message: "Welcome to dashboard",
    user: req.session.user
  });
});

module.exports = router;
