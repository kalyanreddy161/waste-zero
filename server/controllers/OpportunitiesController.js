const Opportunity = require("../models/Opportunities");
const Application = require("../models/Application");
const User = require("../models/User");
const { formatRestrictionMessage, syncModerationState } = require("../utils/accountStatus");
const { sendDirectSystemMessage } = require("../services/chatService");
const { buildOpportunityReportMessage } = require("../utils/moderationMessages");

const sanitizeReason = (value) => String(value || "").trim();

// Create a new opportunity
// Expected body: { ngo_id, title, description, required_skills, duration, location, status? }
const createOpportunity = async (req, res) => {
  try {
    const {
      title,
      description,
      required_skills,
      duration,
      location,
      city,
      status,
      img_link,
    } = req.body;
    const userId = req.session?.user?.id;
    const role = req.session?.user?.role;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (role !== "ngo") {
      return res.status(403).json({ message: "Only NGO users can create opportunities" });
    }

    const ngoUser = await User.findById(userId);
    if (!ngoUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { isRestricted, restrictedUntil } = await syncModerationState(ngoUser);
    if (isRestricted) {
      return res.status(403).json({
        message: formatRestrictionMessage(restrictedUntil, "creating opportunities"),
        restrictedUntil,
      });
    }

    // Coerce duration to number when provided
    const durationNum = (duration === "" || duration === undefined || duration === null) ? undefined : Number(duration);

    // Normalize location payload into GeoJSON Point if possible
    let locationObj = undefined;
    try {
      if (location && typeof location === "object") {
        if (location.type === "Point" && Array.isArray(location.coordinates)) {
          locationObj = { type: "Point", coordinates: location.coordinates.map(Number) };
        } else if (("lat" in location) && ("lon" in location)) {
          locationObj = { type: "Point", coordinates: [Number(location.lat), Number(location.lon)] };
        } else if (Array.isArray(location.coordinates)) {
          locationObj = { type: "Point", coordinates: location.coordinates.map(Number) };
        }
      }
    } catch (e) {
      console.warn("Invalid location payload", e);
      locationObj = undefined;
    }

    const opportunity = new Opportunity({
      ngo_id: userId,
      title,
      description,
      required_skills,
      duration: durationNum,
      location: locationObj,
      city,
      status,
      img_link,
      // participants array removed; do not store participant ids on opportunity
    });

    const saved = await opportunity.save();
    // return populated opportunity so client can show NGO's fullName
    const populated = await Opportunity.findById(saved._id).populate("ngo_id", "fullName");
    // emit a realtime event so connected clients can update their caches
    try {
      if (global && global.io) {
        global.io.emit("opportunity:created", { opportunity: populated });
        console.log("emitted opportunity:created", String(populated._id));
      }
    } catch (e) {
      console.error("Failed to emit opportunity:created", e);
    }
    return res.status(201).json({ message: "Opportunity created", opportunity: populated });
  } catch (err) {
    console.error("Error creating opportunity:", err);
    return res.status(500).json({ message: "Failed to create opportunity" });
  }
};

// Participant list is derived from Application documents. No per-opportunity
// participant array is stored on the Opportunity model.

// Return count of accepted applications for an opportunity
const getParticipantsCount = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Opportunity id is required" });
    // Lazy-load Application model here to avoid circular requires
    const Application = require("../models/Application");
    const count = await Application.countDocuments({ opportunityId: id, status: "accepted" });
    return res.json({ count });
  } catch (err) {
    console.error("Error counting participants:", err);
    return res.status(500).json({ message: "Failed to count participants" });
  }
};

const reportOpportunityToAdmin = async (req, res) => {
  try {
    const reporterId = req.session?.user?.id;
    const reporterRole = req.session?.user?.role;
    const { id } = req.params;
    const reason = sanitizeReason(req.body?.reason);

    if (!reporterId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (reporterRole !== "volunteer") {
      return res.status(403).json({ message: "Only volunteers can report opportunity owners" });
    }

    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const opportunity = await Opportunity.findById(id).populate(
      "ngo_id",
      "fullName username role"
    );
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    const reportedUserId = opportunity.ngo_id?._id || opportunity.ngo_id;
    if (!reportedUserId) {
      return res.status(404).json({ message: "Opportunity owner not found" });
    }

    if (String(reportedUserId) === String(reporterId)) {
      return res.status(400).json({ message: "You cannot report your own opportunity" });
    }

    const [reporter, reportedUser, adminUser] = await Promise.all([
      User.findById(reporterId).select("fullName username role"),
      User.findById(reportedUserId).select("fullName username role"),
      User.findOne({ role: "admin" }).select("_id"),
    ]);

    if (!reporter || !reportedUser) {
      return res.status(404).json({ message: "Unable to complete this report" });
    }

    if (!adminUser) {
      return res.status(500).json({ message: "Admin account not found" });
    }

    const content = buildOpportunityReportMessage({
      reporter,
      reportedUser,
      opportunity,
      reason,
    });

    await sendDirectSystemMessage({
      senderId: reporter._id,
      receiverId: adminUser._id,
      content,
      preview: "User Report",
      notificationSubject: "User Report",
    });

    return res.json({ message: "Reported successfully" });
  } catch (err) {
    console.error("reportOpportunityToAdmin error:", err);
    return res.status(500).json({ message: "Failed to submit report" });
  }
};

// Get all opportunities (newest first)
const getAllOpportunities = async (req, res) => {
  try {
    const opportunities = await Opportunity.find().sort({ createdAt: -1 }).populate("ngo_id", "fullName");
    return res.json(opportunities);
  } catch (err) {
    console.error("Error fetching opportunities:", err);
    return res.status(500).json({ message: "Failed to load opportunities" });
  }
};

// Update an existing opportunity by id
// Expected params: :id
// Body can contain any updatable fields
const updateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };
    const userId = req.session?.user?.id;
    const role = req.session?.user?.role;

    // Coerce duration to number if provided in update
    if (update.duration !== undefined) {
      update.duration = update.duration === "" || update.duration === null ? undefined : Number(update.duration);
    }

    // Normalize location update payload to GeoJSON Point if possible
    if (update.location && typeof update.location === "object") {
      try {
        const loc = update.location;
        if (loc.type === "Point" && Array.isArray(loc.coordinates)) {
          update.location = { type: "Point", coordinates: loc.coordinates.map(Number) };
        } else if (("lat" in loc) && ("lon" in loc)) {
          update.location = { type: "Point", coordinates: [Number(loc.lat), Number(loc.lon)] };
        } else if (Array.isArray(loc.coordinates)) {
          update.location = { type: "Point", coordinates: loc.coordinates.map(Number) };
        }
      } catch (e) {
        // leave update.location as-is so validators can catch it
      }
    }

    const existing = await Opportunity.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (role !== "admin" && String(existing.ngo_id) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await Opportunity.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    // return populated opportunity so client can access NGO fullName
    const populated = await Opportunity.findById(updated._id).populate("ngo_id", "fullName");
    // emit update so clients can refresh caches
    try {
      if (global && global.io) {
        global.io.emit("opportunity:updated", { opportunity: populated });
        console.log("emitted opportunity:updated", String(populated._id));
      }
    } catch (e) {
      console.error("Failed to emit opportunity:updated", e);
    }

    return res.json({ message: "Opportunity updated", opportunity: populated });
  } catch (err) {
    console.error("Error updating opportunity:", err);
    return res.status(500).json({ message: "Failed to update opportunity" });
  }
};

// Delete an opportunity by id
// Expected params: :id
const deleteOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id;
    const role = req.session?.user?.role;
    const opportunity = await Opportunity.findById(id);

    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    if (role !== "admin" && String(opportunity.ngo_id) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deleted = await Opportunity.findByIdAndDelete(id);
    await Application.deleteMany({ opportunityId: id });

    if (!deleted) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    // emit delete so clients can update caches
    try {
      if (global && global.io) {
        global.io.emit("opportunity:deleted", { id: String(deleted._id) });
        console.log("emitted opportunity:deleted", String(deleted._id));
      }
    } catch (e) {
      console.error("Failed to emit opportunity:deleted", e);
    }

    return res.json({ message: "Opportunity deleted" });
  } catch (err) {
    console.error("Error deleting opportunity:", err);
    return res.status(500).json({ message: "Failed to delete opportunity" });
  }
};

// Get a single opportunity by id (populated ngo fullName)
const getOpportunityById = async (req, res) => {
  try {
    const { id } = req.params;
    const opportunity = await Opportunity.findById(id).populate("ngo_id", "fullName");
    if (!opportunity) return res.status(404).json({ message: "Opportunity not found" });
    return res.json(opportunity);
  } catch (err) {
    console.error("Error fetching opportunity by id:", err);
    return res.status(500).json({ message: "Failed to load opportunity" });
  }
};

// Get opportunities by status (route param: :status)
// Accepts: 'open', 'closed', 'in-progress' or alias 'progress' -> 'in-progress'
const getOpportunitiesByStatus = async (req, res) => {
  try {
    let { status } = req.params;

    if (!status) {
      return res.status(400).json({ message: "Status parameter is required" });
    }

    // allow client to send `progress` as alias for `in-progress`
    if (status === "progress") status = "in-progress";

    const allowed = ["open", "closed", "in-progress"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status. Allowed: open, closed, in-progress" });
    }

    const opportunities = await Opportunity.find({ status }).sort({ createdAt: -1 }).populate("ngo_id", "fullName");
    return res.json(opportunities);
  } catch (err) {
    console.error("Error fetching opportunities by status:", err);
    return res.status(500).json({ message: "Failed to load opportunities" });
  }
};

// Get opportunities where title starts with given prefix (route param: :prefix)
// Case-insensitive and escapes regex meta-characters
const getOpportunitiesByTitlePrefix = async (req, res) => {
  try {
    let { prefix } = req.params;

    if (!prefix) {
      return res.status(400).json({ message: "Prefix parameter is required" });
    }

    prefix = prefix.trim();
    if (!prefix) {
      return res.status(400).json({ message: "Prefix parameter is required" });
    }

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp("^" + escapeRegex(prefix), "i");

    const opportunities = await Opportunity.find({ title: { $regex: regex } }).sort({ createdAt: -1 }).populate("ngo_id", "fullName");
    return res.json(opportunities);
  } catch (err) {
    console.error("Error fetching opportunities by title prefix:", err);
    return res.status(500).json({ message: "Failed to load opportunities" });
  }
};

module.exports = {
  getAllOpportunities,
  getOpportunitiesByStatus,
  getOpportunitiesByTitlePrefix,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpportunityById,
  getParticipantsCount,
  reportOpportunityToAdmin,
};
