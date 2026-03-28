const User = require("../models/User");
const Opportunity = require("../models/Opportunities");
const Schedule = require("../models/Schedule");
const Application = require("../models/Application");
const AdminLog = require("../models/AdminLog");
const {
  formatSuspensionMessage,
  clearSuspensionFields,
  clearRestrictionFields,
} = require("../utils/accountStatus");
const {
  emitAccountStatusUpdate,
  emitAdminModerationUpdate,
  runModerationExpirySweep,
} = require("../services/moderationStatusService");
const {
  buildDirectRestrictionNotice,
  buildDirectSuspensionNotice,
  buildOpportunityRestrictionNotice,
  buildOpportunitySuspensionNotice,
  formatDurationLabel,
} = require("../utils/moderationMessages");
const { sendPlainEmail } = require("../services/EmailService");
const { sendDirectSystemMessage } = require("../services/chatService");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WASTE_LABELS = {
  plastic: "Plastic",
  glass: "Glass",
  paper: "Paper",
  "electronic waste": "Electronic Waste",
  organic: "Organic Waste",
  "organic waste": "Organic Waste",
  metal: "Metal",
  other: "Other",
};

const formatActionDate = (date) =>
  date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const REPORT_DURATION_DAYS = 1;

const sanitizeReason = (value, fallback) => {
  const reason = String(value || "").trim();
  return reason || fallback;
};

const clampDurationDays = (value, fallback = 7) =>
  Math.max(1, Math.min(Number(value) || fallback, 365));

const formatTargetLabel = (user) =>
  `${user.fullName} (@${user.username})`;

const getChartContext = (requestedYear) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const allowedYears = [currentYear, currentYear - 1, currentYear - 2];
  const parsedYear = Number(requestedYear);
  const selectedYear = allowedYears.includes(parsedYear) ? parsedYear : currentYear;
  const currentMonthIndex = selectedYear === currentYear ? now.getMonth() : 11;

  return {
    selectedYear,
    currentYear,
    currentMonthIndex,
    chartStart: new Date(selectedYear, 0, 1),
    chartEnd:
      selectedYear === currentYear
        ? new Date(selectedYear, now.getMonth() + 1, 1)
        : new Date(selectedYear + 1, 0, 1),
  };
};

const getValidDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getMonthIndex = (date, currentYear, currentMonthIndex) => {
  const parsed = getValidDate(date);
  if (!parsed || parsed.getFullYear() !== currentYear) {
    return -1;
  }

  const month = parsed.getMonth();
  if (month < 0 || month > currentMonthIndex) {
    return -1;
  }

  return month;
};

const createMonthlySeries = (currentMonthIndex, seedFactory) =>
  MONTHS.slice(0, currentMonthIndex + 1).map((month) => ({
    month,
    ...seedFactory(),
  }));

const normalizeWasteType = (type) => {
  const key = String(type || "").trim().toLowerCase();
  return WASTE_LABELS[key] || "Other";
};

const toPieData = (valueMap) =>
  Object.entries(valueMap)
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

const maxDate = (...values) => {
  const validDates = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (validDates.length === 0) {
    return null;
  }

  return new Date(Math.max(...validDates.map((date) => date.getTime())));
};

const createAdminLog = (action, userId) =>
  AdminLog.create({
    action,
    user_id: userId,
  });

const sendModerationNotice = async ({ user, subject, text, adminId }) => {
  const tasks = [];

  if (user?.email) {
    tasks.push(sendPlainEmail({ to: user.email, subject, text }));
  }

  if (user?._id && adminId) {
    tasks.push(
      sendDirectSystemMessage({
        senderId: adminId,
        receiverId: user._id,
        content: text,
        preview: subject,
        silentSender: true,
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    failures.forEach((failure) => {
      console.error("sendModerationNotice error:", failure.reason);
    });
  }
};

exports.getDashboardAnalytics = async (req, res) => {
  try {
    await runModerationExpirySweep();

    const { selectedYear, currentMonthIndex, chartStart, chartEnd } = getChartContext(req.query.year);

    const [
      activeOpportunities,
      totalOpportunities,
      scheduleSummary,
      opportunities,
      schedules,
    ] = await Promise.all([
      Opportunity.countDocuments({ status: { $in: ["open", "in-progress"] } }),
      Opportunity.countDocuments(),
      Schedule.aggregate([
        {
          $group: {
            _id: null,
            pickupsCompleted: {
              $sum: {
                $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
              },
            },
            co2SavedKg: {
              $sum: { $ifNull: ["$co2Saved", 0] },
            },
          },
        },
      ]),
      Opportunity.find({
        createdAt: {
          $gte: chartStart,
          $lt: chartEnd,
        },
      })
        .select("status createdAt")
        .lean(),
      Schedule.find({
        $or: [
          { createdAt: { $gte: chartStart, $lt: chartEnd } },
          { updatedAt: { $gte: chartStart, $lt: chartEnd } },
          { pickupDate: { $gte: chartStart, $lt: chartEnd } },
        ],
      })
        .select("status pickupDate wasteType co2Saved createdAt updatedAt")
        .lean(),
    ]);

    const totals = scheduleSummary[0] || { pickupsCompleted: 0, co2SavedKg: 0 };

    const opportunityTrends = createMonthlySeries(currentMonthIndex, () => ({
      open: 0,
      inProgress: 0,
      closed: 0,
    }));

    opportunities.forEach((opportunity) => {
      const monthIndex = getMonthIndex(opportunity.createdAt, selectedYear, currentMonthIndex);
      if (monthIndex === -1) {
        return;
      }

      if (opportunity.status === "open") {
        opportunityTrends[monthIndex].open += 1;
      } else if (opportunity.status === "in-progress") {
        opportunityTrends[monthIndex].inProgress += 1;
      } else if (opportunity.status === "closed") {
        opportunityTrends[monthIndex].closed += 1;
      }
    });

    const pickupTrends = createMonthlySeries(currentMonthIndex, () => ({
      scheduled: 0,
      completed: 0,
    }));

    const co2Trends = createMonthlySeries(currentMonthIndex, () => ({
      co2Saved: 0,
    }));

    const allWasteTotals = {};
    const monthlyWasteTotals = MONTHS.slice(0, currentMonthIndex + 1).reduce(
      (acc, month) => ({
        ...acc,
        [month]: {},
      }),
      {}
    );

    schedules.forEach((schedule) => {
      const scheduledDate = getValidDate(schedule.pickupDate || schedule.createdAt);
      const completedDate = getValidDate(schedule.updatedAt || schedule.pickupDate || schedule.createdAt);

      const scheduledMonthIndex = getMonthIndex(scheduledDate, selectedYear, currentMonthIndex);
      if (scheduledMonthIndex !== -1) {
        pickupTrends[scheduledMonthIndex].scheduled += 1;
      }

      if (schedule.status === "completed") {
        const monthIndex = getMonthIndex(completedDate, selectedYear, currentMonthIndex);
        if (monthIndex !== -1) {
          pickupTrends[monthIndex].completed += 1;
          co2Trends[monthIndex].co2Saved += Number(schedule.co2Saved) || 0;

          const wasteType = normalizeWasteType(schedule.wasteType);
          allWasteTotals[wasteType] = (allWasteTotals[wasteType] || 0) + (Number(schedule.co2Saved) || 0);

          const monthLabel = MONTHS[monthIndex];
          monthlyWasteTotals[monthLabel][wasteType] =
            (monthlyWasteTotals[monthLabel][wasteType] || 0) + (Number(schedule.co2Saved) || 0);
        }
      }
    });

    const co2ByWaste = {
      all: toPieData(allWasteTotals),
      months: Object.fromEntries(
        Object.entries(monthlyWasteTotals).map(([month, values]) => [month, toPieData(values)])
      ),
    };

    res.json({
      summary: {
        activeOpportunities,
        totalOpportunities,
        pickupsCompleted: totals.pickupsCompleted || 0,
        co2SavedKg: Number((totals.co2SavedKg || 0).toFixed(2)),
        selectedYear,
      },
      charts: {
        opportunityTrends,
        pickupTrends,
        co2Trends: co2Trends.map((entry) => ({
          ...entry,
          co2Saved: Number(entry.co2Saved.toFixed(2)),
        })),
        co2ByWaste,
      },
    });
  } catch (error) {
    console.error("getDashboardAnalytics error:", error);
    res.status(500).json({ message: "Failed to load admin dashboard analytics" });
  }
};

exports.getAdminOverview = async (req, res) => {
  try {
    await runModerationExpirySweep();

    const [
      users,
      volunteerPickupStats,
      ngoPickupStats,
      opportunityStats,
      applicationStats,
      logs,
      totalLogs,
    ] = await Promise.all([
      User.find({ role: { $ne: "admin" } })
        .select(
          "fullName username email role createdAt updatedAt accountStatus suspendedUntil suspensionReason restrictedUntil restrictionReason"
        )
        .lean(),
      Schedule.aggregate([
        {
          $group: {
            _id: "$userId",
            scheduledPickups: { $sum: 1 },
            completedPickups: {
              $sum: {
                $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
              },
            },
            lastPickupActivity: {
              $max: "$updatedAt",
            },
          },
        },
      ]),
      Schedule.aggregate([
        {
          $match: {
            ngoId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$ngoId",
            pickupsHandled: { $sum: 1 },
            completedPickupsHandled: {
              $sum: {
                $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
              },
            },
            lastHandledPickupActivity: {
              $max: "$updatedAt",
            },
          },
        },
      ]),
      Opportunity.aggregate([
        {
          $group: {
            _id: "$ngo_id",
            totalOpportunities: { $sum: 1 },
            activeOpportunities: {
              $sum: {
                $cond: [{ $in: ["$status", ["open", "in-progress"]] }, 1, 0],
              },
            },
            lastOpportunityActivity: {
              $max: "$updatedAt",
            },
          },
        },
      ]),
      Application.aggregate([
        {
          $group: {
            _id: "$volunteerId",
            totalApplications: { $sum: 1 },
            acceptedApplications: {
              $sum: {
                $cond: [{ $eq: ["$status", "accepted"] }, 1, 0],
              },
            },
            lastApplicationActivity: {
              $max: "$updatedAt",
            },
          },
        },
      ]),
      AdminLog.find()
        .sort({ timestamp: -1 })
        .limit(50)
        .populate("user_id", "fullName username role email")
        .lean(),
      AdminLog.countDocuments(),
    ]);

    const volunteerPickupMap = new Map(
      volunteerPickupStats
        .filter((entry) => entry._id)
        .map((entry) => [String(entry._id), entry])
    );
    const ngoPickupMap = new Map(
      ngoPickupStats
        .filter((entry) => entry._id)
        .map((entry) => [String(entry._id), entry])
    );
    const opportunityMap = new Map(
      opportunityStats
        .filter((entry) => entry._id)
        .map((entry) => [String(entry._id), entry])
    );
    const applicationMap = new Map(
      applicationStats
        .filter((entry) => entry._id)
        .map((entry) => [String(entry._id), entry])
    );

    const shapedUsers = users
      .map((user) => {
        const userId = String(user._id);
        const volunteerMetrics = volunteerPickupMap.get(userId) || {};
        const ngoMetrics = ngoPickupMap.get(userId) || {};
        const opportunityMetrics = opportunityMap.get(userId) || {};
        const applicationMetrics = applicationMap.get(userId) || {};

        const metrics = {
          scheduledPickups: volunteerMetrics.scheduledPickups || 0,
          completedPickups: volunteerMetrics.completedPickups || 0,
          pickupsHandled: ngoMetrics.pickupsHandled || 0,
          completedPickupsHandled: ngoMetrics.completedPickupsHandled || 0,
          totalOpportunities: opportunityMetrics.totalOpportunities || 0,
          activeOpportunities: opportunityMetrics.activeOpportunities || 0,
          totalApplications: applicationMetrics.totalApplications || 0,
          acceptedApplications: applicationMetrics.acceptedApplications || 0,
        };

        const lastActivityAt = maxDate(
          user.updatedAt,
          volunteerMetrics.lastPickupActivity,
          ngoMetrics.lastHandledPickupActivity,
          opportunityMetrics.lastOpportunityActivity,
          applicationMetrics.lastApplicationActivity
        );

        return {
          ...user,
          metrics,
          lastActivityAt,
          moderationStatus:
            user.accountStatus === "suspended"
              ? "suspended"
              : user.restrictedUntil && new Date(user.restrictedUntil) > new Date()
                ? "restricted"
                : "active",
        };
      })
      .sort((a, b) => {
        const timeA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const timeB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return timeB - timeA;
      });

    const suspendedUsers = shapedUsers.filter((user) => user.accountStatus === "suspended").length;
    const restrictedUsers = shapedUsers.filter((user) => user.moderationStatus === "restricted").length;
    const activeUsers = shapedUsers.filter((user) => user.moderationStatus === "active").length;

    res.json({
      summary: {
        totalUsers: shapedUsers.length,
        volunteerUsers: shapedUsers.filter((user) => user.role === "volunteer").length,
        ngoUsers: shapedUsers.filter((user) => user.role === "ngo").length,
        activeUsers,
        restrictedUsers,
        suspendedUsers,
        totalLogs,
      },
      users: shapedUsers,
      logs,
    });
  } catch (error) {
    console.error("getAdminOverview error:", error);
    res.status(500).json({ message: "Failed to load admin overview" });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const adminId = req.session.user.id;
    const { id } = req.params;
    const durationDays = clampDurationDays(req.body?.durationDays, 7);
    const reason = sanitizeReason(req.body?.reason, "Suspended after admin review");

    if (String(adminId) === String(id)) {
      return res.status(400).json({ message: "Admin users cannot suspend themselves" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin accounts cannot be suspended here" });
    }

    const suspendedUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const daysLabel = formatDurationLabel(durationDays);

    user.accountStatus = "suspended";
    user.suspendedUntil = suspendedUntil;
    user.suspensionReason = reason;
    user.suspendedBy = adminId;
    clearRestrictionFields(user);
    await user.save();

    const action = `Admin suspended ${formatTargetLabel(
      user
    )} for ${daysLabel} until ${formatActionDate(suspendedUntil)}. Reason: ${reason}`;
    const log = await createAdminLog(action, user._id);

    await sendModerationNotice({
      user,
      adminId,
      subject: "ACCOUNT SUSPENSION",
      text: buildDirectSuspensionNotice({
        user,
        reason,
        days: durationDays,
      }),
    });

    if (global.io) {
      global.io.to(String(user._id)).emit("account:suspended", {
        message: formatSuspensionMessage(suspendedUntil),
        suspendedUntil,
        reason,
      });
    }
    emitAdminModerationUpdate(user);

    res.json({
      message: "User suspended successfully",
      user: {
        _id: user._id,
        accountStatus: user.accountStatus,
        suspendedUntil: user.suspendedUntil,
        suspensionReason: user.suspensionReason,
      },
      log,
    });
  } catch (error) {
    console.error("suspendUser error:", error);
    res.status(500).json({ message: "Failed to suspend user" });
  }
};

exports.restoreUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin accounts cannot be restored here" });
    }

    clearSuspensionFields(user);
    clearRestrictionFields(user);
    await user.save();

    const action = `Admin restored ${formatTargetLabel(user)} to active status.`;
    const log = await createAdminLog(action, user._id);
    emitAccountStatusUpdate(user, "account:restored");

    res.json({
      message: "User restored successfully",
      user: {
        _id: user._id,
        accountStatus: user.accountStatus,
        suspendedUntil: user.suspendedUntil,
        suspensionReason: user.suspensionReason,
        restrictedUntil: user.restrictedUntil,
        restrictionReason: user.restrictionReason,
        moderationStatus: "active",
      },
      log,
    });
  } catch (error) {
    console.error("restoreUser error:", error);
    res.status(500).json({ message: "Failed to restore user" });
  }
};

exports.restrictUser = async (req, res) => {
  try {
    const adminId = req.session.user.id;
    const { id } = req.params;
    const durationDays = clampDurationDays(req.body?.durationDays, REPORT_DURATION_DAYS);
    const reason = sanitizeReason(req.body?.reason, "Restricted after admin review");

    if (String(adminId) === String(id)) {
      return res.status(400).json({ message: "Admin users cannot restrict themselves" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin accounts cannot be restricted here" });
    }

    const restrictedUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const daysLabel = formatDurationLabel(durationDays);

    user.restrictedUntil = restrictedUntil;
    user.restrictionReason = reason;
    user.restrictedBy = adminId;
    await user.save();

    const action = `Admin restricted ${formatTargetLabel(
      user
    )} for ${daysLabel} until ${formatActionDate(restrictedUntil)}. Reason: ${reason}`;
    const log = await createAdminLog(action, user._id);

    await sendModerationNotice({
      user,
      adminId,
      subject: "ACCOUNT RESTRICTION",
      text: buildDirectRestrictionNotice({
        user,
        reason,
        days: durationDays,
      }),
    });
    emitAccountStatusUpdate(user);

    res.json({
      message: "User restricted successfully",
      user: {
        _id: user._id,
        restrictedUntil: user.restrictedUntil,
        restrictionReason: user.restrictionReason,
        moderationStatus:
          user.accountStatus === "suspended" ? "suspended" : "restricted",
      },
      log,
    });
  } catch (error) {
    console.error("restrictUser error:", error);
    res.status(500).json({ message: "Failed to restrict user" });
  }
};

exports.moderateOpportunityOwner = async (req, res) => {
  try {
    const adminId = req.session.user.id;
    const { id } = req.params;
    const actionType = String(req.body?.actionType || "").trim().toLowerCase();
    const normalizedActionType = actionType === "report" ? "restrict" : actionType;
    const deleteOpportunity = Boolean(req.body?.deleteOpportunity);
    const reason = sanitizeReason(req.body?.reason, "Improper opportunity content reported by admin");

    if (!["restrict", "suspend"].includes(normalizedActionType)) {
      return res.status(400).json({ message: "Invalid moderation action" });
    }

    const opportunity = await Opportunity.findById(id).populate(
      "ngo_id",
      "fullName username email role accountStatus"
    );
    if (!opportunity) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    const owner = await User.findById(opportunity.ngo_id?._id || opportunity.ngo_id);
    if (!owner) {
      return res.status(404).json({ message: "Opportunity owner not found" });
    }

    if (owner.role === "admin") {
      return res.status(400).json({ message: "Admin-owned opportunities cannot be moderated here" });
    }

    let durationDays = REPORT_DURATION_DAYS;
    let noticeText = "";
    let logAction = "";
    let noticeSubject = "ACCOUNT RESTRICTION";

    if (normalizedActionType === "restrict") {
      durationDays = clampDurationDays(req.body?.durationDays, REPORT_DURATION_DAYS);
      const restrictedUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      const daysLabel = formatDurationLabel(durationDays);

      owner.restrictedUntil = restrictedUntil;
      owner.restrictionReason = reason;
      owner.restrictedBy = adminId;
      await owner.save();

      noticeText = buildOpportunityRestrictionNotice({
        user: owner,
        reason,
        days: durationDays,
        opportunityTitle: opportunity.title,
      });
      logAction = `Admin restricted ${formatTargetLabel(owner)} based on opportunity "${
        opportunity.title
      }" for ${daysLabel} until ${formatActionDate(
        restrictedUntil
      )}. Delete opportunity: ${deleteOpportunity ? "yes" : "no"}. Reason: ${reason}`;
    } else {
      durationDays = clampDurationDays(req.body?.durationDays, 7);
      const suspendedUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      const daysLabel = formatDurationLabel(durationDays);
      noticeSubject = "ACCOUNT SUSPENSION";

      owner.accountStatus = "suspended";
      owner.suspendedUntil = suspendedUntil;
      owner.suspensionReason = reason;
      owner.suspendedBy = adminId;
      clearRestrictionFields(owner);
      await owner.save();

      noticeText = buildOpportunitySuspensionNotice({
        user: owner,
        reason,
        days: durationDays,
        opportunityTitle: opportunity.title,
      });
      logAction = `Admin suspended ${formatTargetLabel(owner)} from opportunity "${
        opportunity.title
      }" for ${daysLabel} until ${formatActionDate(
        suspendedUntil
      )}. Delete opportunity: ${deleteOpportunity ? "yes" : "no"}. Reason: ${reason}`;

      if (global.io) {
        global.io.to(String(owner._id)).emit("account:suspended", {
          message: formatSuspensionMessage(suspendedUntil),
          suspendedUntil,
          reason,
        });
      }
      emitAdminModerationUpdate(owner);
    }

    if (deleteOpportunity) {
      await Promise.all([
        Application.deleteMany({ opportunityId: opportunity._id }),
        Opportunity.findByIdAndDelete(opportunity._id),
      ]);

      if (global.io) {
        global.io.emit("opportunity:deleted", { id: String(opportunity._id) });
      }
    }

    const log = await createAdminLog(logAction, owner._id);

    await sendModerationNotice({
      user: owner,
      adminId,
      subject: noticeSubject,
      text: noticeText,
    });
    if (normalizedActionType === "restrict") {
      emitAccountStatusUpdate(owner);
    }

    res.json({
      message:
        normalizedActionType === "restrict"
          ? "Opportunity owner restricted successfully"
          : "Opportunity owner suspended successfully",
      deletedOpportunityId: deleteOpportunity ? String(opportunity._id) : null,
      log,
      user: {
        _id: owner._id,
        accountStatus: owner.accountStatus,
        suspendedUntil: owner.suspendedUntil,
        suspensionReason: owner.suspensionReason,
        restrictedUntil: owner.restrictedUntil,
        restrictionReason: owner.restrictionReason,
      },
    });
  } catch (error) {
    console.error("moderateOpportunityOwner error:", error);
    res.status(500).json({ message: "Failed to moderate opportunity owner" });
  }
};
