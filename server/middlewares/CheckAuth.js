const User = require("../models/User");
const {
  formatSuspensionMessage,
  syncSuspensionState,
} = require("../utils/accountStatus");

const destroySession = (req) =>
  new Promise((resolve) => {
    if (!req.session) {
      resolve();
      return;
    }

    req.session.destroy(() => resolve());
  });

const checkAuth = async (req, res, next) => {
  if (!(req.session && req.session.isAuthenticated && req.session.user?.id)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      await destroySession(req);
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { isSuspended, suspendedUntil } = await syncSuspensionState(user);
    if (isSuspended) {
      await destroySession(req);
      return res.status(403).json({
        message: formatSuspensionMessage(suspendedUntil),
        suspendedUntil,
      });
    }

    req.session.user = {
      ...req.session.user,
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    return next();
  } catch (error) {
    console.error("checkAuth error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = checkAuth;
