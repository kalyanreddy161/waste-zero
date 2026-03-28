const Schedule = require("../models/Schedule");
const { notify } = require("../services/notificationService");
const User = require("../models/User");
const { sendDirectSystemMessage } = require("../services/chatService");
const {
  formatRestrictionMessage,
  syncModerationState,
} = require("../utils/accountStatus");
const { buildPickupReportMessage } = require("../utils/moderationMessages");

const sanitizeReason = (value) => String(value || "").trim();
const sanitizePhoneNumber = (value) => String(value || "").replace(/\D/g, "").slice(0, 10);

const formatPickupLocation = (pickup) => {
  const parts = [
    pickup?.address?.street,
    pickup?.address?.village,
    pickup?.address?.city,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  if (parts.length) {
    return parts.join(", ");
  }

  const coordinates = pickup?.location?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    return `${coordinates[0]}, ${coordinates[1]}`;
  }

  return "Not specified";
};

function calculateCO2(type, q) {
  const efficiency = 0.8; // 80% realistic recovery

  switch (type.toLowerCase()) {
    case "plastic":
      return (6 - 2.5) * q * efficiency;

    case "paper":
      return (1.3 - 0.5) * q * efficiency;

    case "glass":
      return (0.9 - 0.4) * q * efficiency;

    case "metal":
      return (2.5 - 1.0) * q * efficiency;

    case "organic waste":
      return ((0.06 * q * (28 - 2.75)) + (0.5 * q)) * efficiency;

    case "electronic waste":
      return (8 - 3) * q * efficiency;

    default:
      return 0;
  }
}

exports.createPickup = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const role = req.session?.user?.role;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (role !== "volunteer") {
      return res.status(403).json({ message: "Only volunteers can schedule pickups" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { isRestricted, restrictedUntil } = await syncModerationState(user);
    if (isRestricted) {
      return res.status(403).json({
        message: formatRestrictionMessage(restrictedUntil, "scheduling pickups"),
        restrictedUntil,
      });
    }

    const { wasteType, quantity, phone, lat, lon, city, village, street, pickupDate } = req.body;
    const sanitizedPhone = sanitizePhoneNumber(phone);

    if (sanitizedPhone.length !== 10) {
      return res.status(400).json({ message: "A valid 10-digit phone number is required" });
    }

    const pickup = new Schedule({
      userId,
      wasteType,
      quantity: Number(quantity),
      location: {
        type: "Point",
        coordinates: [Number(lat), Number(lon)]
      },
      address: {
        city,
        village,
        street
      },
      phone: sanitizedPhone,
      pickupDate
    });

    await pickup.save();

    const populatedPickup = await Schedule.findById(pickup._id)
      .populate("userId", "fullName email phone")
      .populate("ngoId", "fullName email phone")
      .lean();

    if (global.io) {
      global.io.emit("pickup:created", populatedPickup);
    }

    res.status(201).json({
      success: true,
      message: "Pickup scheduled successfully",
      pickup: populatedPickup
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPickups = async (req, res) => {
  try {
    let query = {};
    if (req.session.user.role === "volunteer") {
      query.userId = req.session.user.id;
    }

    const pickups = await Schedule.find(query)
      .populate("userId", "fullName email phone")
      .populate("ngoId", "fullName email phone")
      .sort({ createdAt: -1 })
      .lean();
    res.json(pickups);
  } catch (error) {
    res.status(500).json({ message: "Error fetching pickups" });
  }
};

exports.getPickupStats = async (req, res) => {
  try {
    let query = { status: "completed" };
    if (req.session.user.role === "ngo") {
      query.ngoId = req.session.user.id;
    } else {
      query.userId = req.session.user.id;
    }

    const pickups = await Schedule.find(query).lean();
    const completedCount = pickups.length;
    const co2Saved = pickups.reduce((sum, p) => sum + (Number(p.co2Saved) || 0), 0);

    res.json({ completedCount, co2Saved });
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats" });
  }
};

exports.acceptPickup = async (req, res) => {
  try {
    const ngoId = req.session?.user?.id;
    const role = req.session?.user?.role;

    if (!ngoId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (role !== "ngo") {
      return res.status(403).json({ message: "Only NGO users can claim pickups" });
    }

    const ngoUser = await User.findById(ngoId);
    if (!ngoUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { isRestricted, restrictedUntil } = await syncModerationState(ngoUser);
    if (isRestricted) {
      return res.status(403).json({
        message: formatRestrictionMessage(restrictedUntil, "claiming pickups"),
        restrictedUntil,
      });
    }

    const { id } = req.params;
    const { agent } = req.body;
    const sanitizedAgent = {
      name: String(agent?.name || "").trim(),
      phone: sanitizePhoneNumber(agent?.phone),
    };

    if (!sanitizedAgent.name || sanitizedAgent.phone.length !== 10) {
      return res.status(400).json({ message: "Agent name and a valid 10-digit mobile number are required" });
    }

    const pickup = await Schedule.findByIdAndUpdate(
      id,
      {
        status: "accepted",
        ngoId,
        agent: sanitizedAgent
      },
      { new: true }
    )
      .populate("userId", "fullName email phone")
      .populate("ngoId", "fullName email phone")
      .lean();

    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    if (global.io) {
      global.io.emit("pickup:accepted", pickup);
    }

    // Notify the volunteer who created this pickup
    if (pickup.userId && pickup.userId._id) {
      await notify({
        io: global.io,
        receiverId: pickup.userId._id,
        senderId: req.session.user.id,
        type: "pickup_accepted",
        referenceId: pickup._id,
        meta: {
          pickupId: String(pickup._id),
          ngoName: pickup.ngoId ? pickup.ngoId.fullName : 'an NGO'
        }
      });
    }

    res.json({ success: true, pickup });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.completePickup = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.session?.user?.role;

    if (!["volunteer", "ngo"].includes(role)) {
      return res.status(403).json({ message: "Only volunteer and NGO users can update pickups" });
    }

    const existingPickup = await Schedule.findById(id);
    if (!existingPickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    const co2Saved = calculateCO2(existingPickup.wasteType, existingPickup.quantity);

    const pickup = await Schedule.findByIdAndUpdate(
      id,
      { status: "completed", co2Saved },
      { new: true }
    )
      .populate("userId", "fullName email phone")
      .populate("ngoId", "fullName email phone")
      .lean();

    if (global.io) {
      global.io.emit("pickup:completed", { ...pickup, initiatorId: req.session.user.id });
    }

    const receiverId = req.session.user.role === 'ngo' ? pickup.userId._id : pickup.ngoId._id;
    if (receiverId) {
      await notify({
        io: global.io,
        receiverId,
        senderId: req.session.user.id,
        type: "pickup_completed",
        referenceId: pickup._id,
        meta: {
          pickupId: String(pickup._id),
          co2Saved: pickup.co2Saved
        }
      });
    }

    res.json({ success: true, pickup });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updatePickup = async (req, res) => {
  try {
    const { id } = req.params;
    const { wasteType, quantity, phone, lat, lon, city, village, street, pickupDate } = req.body;
    const sanitizedPhone = sanitizePhoneNumber(phone);

    if (sanitizedPhone.length !== 10) {
      return res.status(400).json({ message: "A valid 10-digit phone number is required" });
    }

    const pickup = await Schedule.findOneAndUpdate(
      { _id: id, userId: req.session.user.id, status: { $in: ["scheduled"] } },
      {
        wasteType,
        quantity: quantity ? Number(quantity) : undefined,
        location: (lat && lon) ? {
          type: "Point",
          coordinates: [Number(lat), Number(lon)]
        } : undefined,
        address: (city || village || street) ? {
          city,
          village,
          street
        } : undefined,
        phone: sanitizedPhone,
        pickupDate
      },
      { new: true, omitUndefined: true }
    )
      .populate("userId", "fullName email phone")
      .populate("ngoId", "fullName email phone")
      .lean();

    if (!pickup) return res.status(404).json({ message: "Pickup not found or cannot be modified" });

    if (global.io) {
      global.io.emit("pickup:updated", pickup);
    }
    res.json({ success: true, pickup });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deletePickup = async (req, res) => {
  try {
    const { id } = req.params;

    const pickup = await Schedule.findOne({ _id: id, userId: req.session.user.id });
    if (!pickup) return res.status(404).json({ message: "Pickup not found" });
    if (pickup.status === "accepted") return res.status(400).json({ message: "Cannot delete accepted pickup" });

    await Schedule.deleteOne({ _id: id });

    if (global.io) {
      global.io.emit("pickup:deleted", { id });
    }
    res.json({ success: true, message: "Pickup deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.reportPickupUserToAdmin = async (req, res) => {
  try {
    const reporterId = req.session?.user?.id;
    const reporterRole = req.session?.user?.role;
    const { id } = req.params;
    const reason = sanitizeReason(req.body?.reason);

    if (!reporterId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!["volunteer", "ngo"].includes(reporterRole)) {
      return res.status(403).json({ message: "Only volunteer and NGO users can report pickup participants" });
    }

    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const pickup = await Schedule.findById(id)
      .populate("userId", "fullName username role")
      .populate("ngoId", "fullName username role");

    if (!pickup) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    if (pickup.status !== "accepted") {
      return res.status(400).json({ message: "You can report a user only for accepted pickups" });
    }

    const volunteerId = pickup.userId?._id || pickup.userId;
    const ngoId = pickup.ngoId?._id || pickup.ngoId;
    const isVolunteerReporter =
      reporterRole === "volunteer" && String(volunteerId) === String(reporterId);
    const isNgoReporter =
      reporterRole === "ngo" && ngoId && String(ngoId) === String(reporterId);

    if (!isVolunteerReporter && !isNgoReporter) {
      return res.status(403).json({ message: "You can only report a user from your own pickup" });
    }

    const reportedUser = isVolunteerReporter ? pickup.ngoId : pickup.userId;
    if (!reportedUser?._id && !reportedUser) {
      return res.status(404).json({ message: "Reported user not found" });
    }

    const [reporter, adminUser] = await Promise.all([
      User.findById(reporterId).select("fullName username role"),
      User.findOne({ role: "admin" }).select("_id"),
    ]);

    if (!reporter) {
      return res.status(404).json({ message: "Reporter not found" });
    }

    if (!adminUser) {
      return res.status(500).json({ message: "Admin account not found" });
    }

    const content = buildPickupReportMessage({
      reporter,
      reportedUser,
      pickup,
      reason,
      location: formatPickupLocation(pickup),
    });

    await sendDirectSystemMessage({
      senderId: reporter._id,
      receiverId: adminUser._id,
      content,
      preview: "User Report",
      notificationSubject: "User Report",
    });

    res.json({ message: "Reported successfully" });
  } catch (error) {
    console.error("reportPickupUserToAdmin error:", error);
    res.status(500).json({ message: "Failed to submit report" });
  }
};
