const User = require("../models/User");
const AdminLog = require("../models/AdminLog");

const formatTargetLabel = (user) =>
  `${user.fullName} (@${user.username})`;

const clearSuspensionFields = (user) => {
  user.accountStatus = "active";
  user.suspendedUntil = undefined;
  user.suspensionReason = "";
  user.suspendedBy = undefined;
};

const clearRestrictionFields = (user) => {
  user.restrictedUntil = undefined;
  user.restrictionReason = "";
  user.restrictedBy = undefined;
};

const hasFutureDate = (value) => {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date > new Date();
};

const buildAccountStatusPayload = (user) => {
  const isSuspended =
    user?.accountStatus === "suspended" && hasFutureDate(user?.suspendedUntil);
  const isRestricted = hasFutureDate(user?.restrictedUntil);

  return {
    _id: user?._id,
    accountStatus: isSuspended ? "suspended" : "active",
    suspendedUntil: isSuspended ? user?.suspendedUntil || null : null,
    suspensionReason: isSuspended ? user?.suspensionReason || "" : "",
    restrictedUntil: isRestricted ? user?.restrictedUntil || null : null,
    restrictionReason: isRestricted ? user?.restrictionReason || "" : "",
    moderationStatus: isSuspended
      ? "suspended"
      : isRestricted
        ? "restricted"
        : "active",
  };
};

const emitAdminModerationUpdate = (user) => {
  if (!global.io || !user?._id) {
    return;
  }

  global.io.emit("admin:moderation-updated", {
    userId: String(user._id),
    moderationStatus: buildAccountStatusPayload(user).moderationStatus,
  });
};

const emitAccountStatusUpdate = (user, eventName = "account:status-updated") => {
  if (!global.io || !user?._id) {
    return buildAccountStatusPayload(user);
  }

  const payload = buildAccountStatusPayload(user);
  const roomId = String(user._id);

  global.io.to(roomId).emit("account:status-updated", payload);
  if (eventName && eventName !== "account:status-updated") {
    global.io.to(roomId).emit(eventName, payload);
  }

  emitAdminModerationUpdate(user);

  return payload;
};

const buildAutoRestoreAction = (user, restoredStates) => {
  if (restoredStates.length === 2) {
    return `System automatically restored ${formatTargetLabel(
      user
    )} after suspension and restriction periods expired.`;
  }

  if (restoredStates[0] === "suspension") {
    return `System automatically restored ${formatTargetLabel(
      user
    )} after the suspension period expired.`;
  }

  return `System automatically restored ${formatTargetLabel(
    user
  )} after the restriction period expired.`;
};

const finalizeExpiredModerationRestore = async (user, restoredStates) => {
  if (!user || !restoredStates?.length) {
    return null;
  }

  const now = new Date();
  const expiryFilters = [];

  if (restoredStates.includes("suspension")) {
    expiryFilters.push({
      accountStatus: "suspended",
      suspendedUntil: { $ne: null, $lte: now },
    });
  }

  if (restoredStates.includes("restriction")) {
    expiryFilters.push({
      restrictedUntil: { $ne: null, $lte: now },
    });
  }

  const currentUser = await User.findOne({
    _id: user._id,
    $or: expiryFilters,
  });
  if (!currentUser) {
    return null;
  }

  if (restoredStates.includes("suspension")) {
    clearSuspensionFields(currentUser);
  }

  if (restoredStates.includes("restriction")) {
    clearRestrictionFields(currentUser);
  }

  await currentUser.save();
  await AdminLog.create({
    action: buildAutoRestoreAction(currentUser, restoredStates),
    user_id: currentUser._id,
  });

  emitAccountStatusUpdate(currentUser, "account:restored");
  return currentUser;
};

const runModerationExpirySweep = async () => {
  const now = new Date();
  const users = await User.find({
    $or: [
      {
        accountStatus: "suspended",
        suspendedUntil: { $ne: null, $lte: now },
      },
      {
        restrictedUntil: { $ne: null, $lte: now },
      },
    ],
  });

  const restoredUsers = [];

  for (const user of users) {
    const restoredStates = [];
    const suspendedUntil = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
    const restrictedUntil = user.restrictedUntil ? new Date(user.restrictedUntil) : null;

    if (
      user.accountStatus === "suspended" &&
      suspendedUntil &&
      !Number.isNaN(suspendedUntil.getTime()) &&
      suspendedUntil <= now
    ) {
      clearSuspensionFields(user);
      restoredStates.push("suspension");
    }

    if (
      restrictedUntil &&
      !Number.isNaN(restrictedUntil.getTime()) &&
      restrictedUntil <= now
    ) {
      clearRestrictionFields(user);
      restoredStates.push("restriction");
    }

    if (restoredStates.length === 0) {
      continue;
    }

    const restoredUser = await finalizeExpiredModerationRestore(user, restoredStates);
    if (restoredUser) {
      restoredUsers.push(restoredUser);
    }
  }

  return restoredUsers;
};

module.exports = {
  buildAccountStatusPayload,
  emitAccountStatusUpdate,
  emitAdminModerationUpdate,
  finalizeExpiredModerationRestore,
  runModerationExpirySweep,
};
