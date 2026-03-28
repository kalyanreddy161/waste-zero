const {
  finalizeExpiredModerationRestore,
} = require("../services/moderationStatusService");

function formatStatusDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSuspensionMessage(suspendedUntil) {
  const formatted = formatStatusDate(suspendedUntil);
  if (!formatted) {
    return "Your account is temporarily suspended by WasteZero admin.";
  }

  return `Your account is temporarily suspended until ${formatted}.`;
}

function formatRestrictionMessage(restrictedUntil, blockedAction) {
  const formatted = formatStatusDate(restrictedUntil);
  const actionText = blockedAction ? ` from ${blockedAction}` : "";

  if (!formatted) {
    return `You are temporarily restricted${actionText} by WasteZero admin.`;
  }

  return `You are temporarily restricted${actionText} until ${formatted}.`;
}

function clearSuspensionFields(user) {
  user.accountStatus = "active";
  user.suspendedUntil = undefined;
  user.suspensionReason = "";
  user.suspendedBy = undefined;
}

function clearRestrictionFields(user) {
  user.restrictedUntil = undefined;
  user.restrictionReason = "";
  user.restrictedBy = undefined;
}

async function syncModerationState(user) {
  if (!user) {
    return {
      isSuspended: false,
      suspendedUntil: null,
      isRestricted: false,
      restrictedUntil: null,
    };
  }

  const now = new Date();
  const suspendedUntil = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
  const restrictedUntil = user.restrictedUntil ? new Date(user.restrictedUntil) : null;
  let changed = false;
  const restoredStates = [];

  if (
    user.accountStatus === "suspended" &&
    suspendedUntil &&
    suspendedUntil <= now
  ) {
    clearSuspensionFields(user);
    changed = true;
    restoredStates.push("suspension");
  }

  if (restrictedUntil && restrictedUntil <= now) {
    clearRestrictionFields(user);
    changed = true;
    restoredStates.push("restriction");
  }

  if (changed) {
    await finalizeExpiredModerationRestore(user, restoredStates);
  }

  const isSuspended =
    user.accountStatus === "suspended" &&
    (!suspendedUntil || suspendedUntil > now);

  const isRestricted = Boolean(
    user.restrictedUntil && new Date(user.restrictedUntil) > now
  );

  return {
    isSuspended,
    suspendedUntil: isSuspended ? user.suspendedUntil : null,
    isRestricted,
    restrictedUntil: isRestricted ? user.restrictedUntil : null,
  };
}

async function syncSuspensionState(user) {
  const { isSuspended, suspendedUntil } = await syncModerationState(user);
  return { isSuspended, suspendedUntil };
}

module.exports = {
  formatSuspensionMessage,
  formatRestrictionMessage,
  syncModerationState,
  syncSuspensionState,
  clearSuspensionFields,
  clearRestrictionFields,
};
