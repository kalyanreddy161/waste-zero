const formatRoleLabel = (role) => {
  const value = String(role || "").trim().toLowerCase();

  if (value === "ngo") {
    return "NGO";
  }

  if (value === "volunteer") {
    return "Volunteer";
  }

  if (value === "admin") {
    return "Admin";
  }

  return role || "User";
};

const getDisplayName = (user) =>
  user?.fullName || user?.name || user?.username || "User";

const formatDateOnly = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return date.toISOString().split("T")[0];
};

const formatDurationLabel = (days) => {
  const numericDays = Number(days) || 0;
  if (numericDays === 30) {
    return "1 month";
  }

  return `${numericDays} day(s)`;
};

const getRestrictedFeaturesText = (role) =>
  String(role || "").trim().toLowerCase() === "ngo"
    ? "creating opportunities, claim pickups"
    : "applying opportunities, schedule pickup";

const buildOpportunityReportMessage = ({
  reporter,
  reportedUser,
  opportunity,
  reason,
}) => `User Report

Reported By: ${getDisplayName(reporter)} (${formatRoleLabel(reporter?.role)})
Reported User: ${getDisplayName(reportedUser)} (${formatRoleLabel(reportedUser?.role)})

Opportunity: "${opportunity?.title || "Untitled Opportunity"}"

Reason Selected: ${reason}

 -${getDisplayName(reporter)} volunteer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

const buildPickupReportMessage = ({
  reporter,
  reportedUser,
  pickup,
  reason,
  location,
}) => `User Report

Reported By: ${getDisplayName(reporter)} (${formatRoleLabel(reporter?.role)})
Reported User: ${getDisplayName(reportedUser)} (${formatRoleLabel(reportedUser?.role)})

Pickup ID: ${String(pickup?._id || pickup?.id || "").trim()}

Reason Selected: ${reason}

Pickup Details:

* Scheduled Date: ${formatDateOnly(pickup?.pickupDate || pickup?.date)}
* Location: ${location || "Not specified"}

 -${getDisplayName(reporter)} ${formatRoleLabel(reporter?.role)}.

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

const buildDirectSuspensionNotice = ({ user, reason, days }) => `ACCOUNT SUSPENSION

Hello ${getDisplayName(user)},

Your account has been reviewed by the admin team and found to be in violation of platform guidelines.

Reason: ${reason}

As a result, your account has been suspended for ${days} day(s).
During this period, you will not be able to access or use platform features.
Repeated violations may lead to permanent suspension.

If you believe this action was taken in error, you may contact support.

– Admin Team`;

const buildDirectRestrictionNotice = ({ user, reason, days }) => `ACCOUNT RESTRICTION

Hello ${getDisplayName(user)},

Your account activity has been reviewed by the admin team and flagged for violating platform guidelines.

Reason: ${reason}

This is a warning. As a temporary restriction, certain features of your account have been limited for ${days} day(s).

Restricted Features: ${getRestrictedFeaturesText(user?.role)}.

Please adhere to platform guidelines to avoid further action, including suspension.

– Admin Team`;

const buildOpportunitySuspensionNotice = ({
  user,
  reason,
  days,
  opportunityTitle,
}) => `ACCOUNT SUSPENSION

Hello ${getDisplayName(user)},

We have identified inappropriate behaviour related to "${opportunityTitle}".

Reason: ${reason}

As a result, your account has been suspended for ${days} day(s). During this period, you will not be able to access or use platform features.

If you believe this action was taken in error, you may contact support.

– Admin Team`;

const buildOpportunityRestrictionNotice = ({
  user,
  reason,
  days,
  opportunityTitle,
}) => `ACCOUNT RESTRICTION

Hello ${getDisplayName(user)},

We have observed inappropriate behaviour related to "${opportunityTitle}".

Reason: ${reason}

This serves as a warning. As a temporary restriction, you will not be allowed to create opportunities for ${days} day(s).

Please ensure compliance with platform guidelines to avoid further action.

– Admin Team`;

module.exports = {
  buildDirectRestrictionNotice,
  buildDirectSuspensionNotice,
  buildOpportunityReportMessage,
  buildOpportunityRestrictionNotice,
  buildOpportunitySuspensionNotice,
  buildPickupReportMessage,
  formatDurationLabel,
  formatRoleLabel,
  getDisplayName,
};
