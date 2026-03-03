const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { sendVerificationEmail } = require("../services/EmailService");

/* ======================
   CHECK USERNAME EXISTS
====================== */
exports.existUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });

    res.json({ exists: !!user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================
   CHECK EMAIL EXISTS
====================== */
exports.existEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Consider email as "existing" only when the user's profile is completed.
    const exists = !!user && !!user.isProfileCompleted;
    res.json({ exists });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
/* ======================
  send OTP
====================== */
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const userEmail = email.toLowerCase().trim();

    // Find existing user first
    let user = await User.findOne({ email: userEmail });

    // generate OTP and expiry AFTER locating the user
    const otp = await sendVerificationEmail(userEmail);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    if (!user) {
      // Create temporary user with default values
      const hashedTempPassword = await bcrypt.hash("temp_password", 10);

      user = new User({
        fullName: "temp",
        username: "temp_" + Date.now(),
        email: userEmail,
        password: hashedTempPassword,
        role: "volunteer", // default valid enum
        otp: otp,
        otpExpiresAt: otpExpiry,
        isProfileCompleted: false,
      });
    } else {
      // Update existing user OTP and expiry
      user.otp = otp;
      user.otpExpiresAt = otpExpiry;
    }

    await user.save();

    res.status(200).json({ message: "OTP sent successfully" });

  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ message: error.message });
  }
};
/* =====================
      verification code
====================== */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const userEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(400).json({ message: "Email not found" });
    }

    if (!user.otp || !user.otpExpiresAt) {
      return res.status(400).json({ message: "OTP not requested" });
    }

    if (user.otp !== Number(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    res.status(200).json({ message: "OTP verified successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================
   REGISTER USER
====================== */
exports.register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      username,
      password,
      role,
      skills,
      location,
      bio
    } = req.body;

    const userEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(400).json({ message: "Please verify email first" });
    }

    if (user.isProfileCompleted) {
      return res.status(400).json({ message: "User already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Update fields
    user.fullName = fullName;
    user.username = username;
    user.password = hashedPassword;
    user.role = role.toLowerCase();
    user.skills = skills || [];
    user.bio = bio || "";

    if (
      location &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length === 2
    ) {
      user.location = {
        type: "Point",
        coordinates: location.coordinates
      };
    }

    user.isProfileCompleted = true;

    // Clear OTP
    user.otp = undefined;
    user.otpExpiresAt = undefined;

    

    await user.save();

    const userObj = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role
    };

    req.session.user = userObj;
    req.session.isAuthenticated = true;

    res.status(200).json({
      message: "User registered successfully",
      user: userObj
    });

  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: error.message });
  }
};


/* ======================
   LOGIN USER (SESSION)
====================== */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const userObj = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role
    };

    req.session.user = userObj;
    req.session.isAuthenticated = true;

    res.json({
      message: "Login successful",
      user: userObj
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================
   LOGOUT USER
====================== */
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
};

