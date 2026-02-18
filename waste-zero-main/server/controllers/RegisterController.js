const User = require("../models/User");
const bcrypt = require("bcryptjs");

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

    res.json({ exists: !!user });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      fullName,
      email,
      username,
      password: hashedPassword,
      role: role.toLowerCase()
    };

    if (skills) userData.skills = skills;
    if (bio) userData.bio = bio;

    // ✅ Only attach location if valid coordinates exist
    if (
      location &&
      Array.isArray(location.coordinates) &&
      location.coordinates.length === 2
    ) {
      userData.location = {
        type: "Point",
        coordinates: location.coordinates
      };
    }

    const user = new User(userData);
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

    res.status(201).json({ message: "User registered successfully", user: userObj });
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

