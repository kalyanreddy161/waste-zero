const Application = require("../models/Application");
const Opportunity = require("../models/Opportunities");
const User = require("../models/User");
const Notification = require("../models/Notification");
const sendNotification = require("../utils/sendNotification");

// Volunteer applies to an opportunity
// POST /applications/apply
// body: { opportunityId }
const applyOpportunity = async (req, res) => {
  try {
    const volunteerId = req.session && req.session.user && req.session.user.id;
    if (!volunteerId) return res.status(401).json({ message: "Unauthorized" });

    const { opportunityId } = req.body;
    if (!opportunityId) return res.status(400).json({ message: "opportunityId is required" });

    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) return res.status(404).json({ message: "Opportunity not found" });

    // prevent duplicate application
    const exists = await Application.findOne({ opportunityId, volunteerId });
    if (exists) return res.status(409).json({ message: "Already applied" });

    const application = new Application({ opportunityId, volunteerId, status: "pending" });
    const saved = await application.save();

    // notify NGO
    const ngoId = opportunity.ngo_id;
    await sendNotification({ receiverId: ngoId, senderId: volunteerId, type: "application", referenceId: saved._id, application_id: saved._id });

    return res.status(201).json({ message: "Application created", application: saved });
  } catch (err) {
    console.error("applyOpportunity error:", err);
    if (err.code === 11000) return res.status(409).json({ message: "Duplicate application" });
    return res.status(500).json({ message: "Failed to apply" });
  }
};

// NGO accepts or rejects an application
// POST /applications/:id/respond
// body: { status: 'accepted'|'rejected' }
const respondApplication = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });

    const application = await Application.findById(id).populate("opportunityId");
    if (!application) return res.status(404).json({ message: "Application not found" });

    const opportunity = application.opportunityId;
    if (!opportunity) return res.status(400).json({ message: "Invalid opportunity reference" });

    // only NGO who owns opportunity can respond
    if (String(opportunity.ngo_id) !== String(userId)) return res.status(403).json({ message: "Forbidden" });

    application.status = status;
    await application.save();

    // notify volunteer
    await sendNotification({ receiverId: application.volunteerId, senderId: userId, type: status, referenceId: application._id, application_id: application._id });

    // emit real-time event to all connected users for dashboard stats update
    try {
      if (global && global.io) {
        global.io.emit("application:status-changed", {
          applicationId: String(application._id),
          volunteerId: String(application.volunteerId),
          opportunityId: String(application.opportunityId._id),
          status: status,
        });
        console.log("emitted application:status-changed", String(application._id));
      }
    } catch (e) {
      console.error("Failed to emit application:status-changed", e);
    }

    return res.json({ message: "Application updated", application });
  } catch (err) {
    console.error("respondApplication error:", err);
    return res.status(500).json({ message: "Failed to respond to application" });
  }
};

// Volunteer fetches applied opportunities
// GET /applications/my
const getApplicationsByVolunteer = async (req, res) => {
  try {
    const volunteerId = req.session && req.session.user && req.session.user.id;
    if (!volunteerId) return res.status(401).json({ message: "Unauthorized" });

    const apps = await Application.find({ volunteerId }).sort({ createdAt: -1 }).populate("opportunityId");
    return res.json(apps);
  } catch (err) {
    console.error("getApplicationsByVolunteer error:", err);
    return res.status(500).json({ message: "Failed to load applications" });
  }
};

// NGO fetches applicants for an opportunity
// GET /applications/opportunity/:id
const getApplicantsByOpportunity = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const opportunity = await Opportunity.findById(id);
    if (!opportunity) return res.status(404).json({ message: "Opportunity not found" });

    if (String(opportunity.ngo_id) !== String(userId)) return res.status(403).json({ message: "Forbidden" });

    const apps = await Application.find({ opportunityId: id }).sort({ createdAt: -1 }).populate("volunteerId", "fullName");
    return res.json(apps);
  } catch (err) {
    console.error("getApplicantsByOpportunity error:", err);
    return res.status(500).json({ message: "Failed to load applicants" });
  }
};

// Get single application by id (populated)
// GET /applications/:id
const getApplicationById = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const application = await Application.findById(id).populate("volunteerId", "fullName email").populate("opportunityId");
    if (!application) return res.status(404).json({ message: "Application not found" });

    const opportunity = application.opportunityId;

    // allow if requester is the volunteer who applied
    if (String(application.volunteerId._id || application.volunteerId) === String(userId)) {
      return res.json(application);
    }

    // allow if requester is NGO who owns opportunity
    if (opportunity && String(opportunity.ngo_id) === String(userId)) {
      return res.json(application);
    }

    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    console.error("getApplicationById error:", err);
    return res.status(500).json({ message: "Failed to load application" });
  }
};

const deleteApplication = async (req, res) => {
  try {
    const userId = req.session && req.session.user && req.session.user.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const application = await Application.findById(id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    // only the volunteer who applied can delete
    if (String(application.volunteerId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // if pending, delete the notification sent to NGO
    if (application.status === "pending") {
      await Notification.deleteMany({ referenceId: id, type: "application" });
    }

    await Application.findByIdAndDelete(id);
    return res.json({ message: "Application removed" });
  } catch (err) {
    console.error("deleteApplication error:", err);
    return res.status(500).json({ message: "Failed to delete application" });
  }
};

module.exports = {
  applyOpportunity,
  respondApplication,
  getApplicationsByVolunteer,
  getApplicantsByOpportunity,
  getApplicationById,
  deleteApplication,
};
