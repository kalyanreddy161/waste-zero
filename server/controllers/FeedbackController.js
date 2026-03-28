const Feedback = require("../models/Feedback");

const sanitizeFeedback = (value) => String(value || "").trim();

exports.submitFeedback = async (req, res) => {
  try {
    const user = req.session?.user;
    const feedbackText = sanitizeFeedback(req.body?.feedback);

    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Admin users cannot submit feedback" });
    }

    if (!feedbackText) {
      return res.status(400).json({ message: "Feedback is required" });
    }

    const feedback = await Feedback.create({
      username: user.username || user.fullName || "unknown-user",
      feedback: feedbackText,
    });

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback,
    });
  } catch (error) {
    console.error("submitFeedback error:", error);
    res.status(500).json({ message: "Failed to submit feedback" });
  }
};

exports.getFeedback = async (req, res) => {
  try {
    if (req.session?.user?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const feedback = await Feedback.find().sort({ createdAt: -1 }).lean();
    res.json(feedback);
  } catch (error) {
    console.error("getFeedback error:", error);
    res.status(500).json({ message: "Failed to load feedback" });
  }
};
