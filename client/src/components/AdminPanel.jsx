import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, useMe } from "../Services/useMe";
import socket from "../services/socket";
import MessageBox from "./MessageBox";
import ActionButton from "./ActionButton";
import "../styles/NavbarComponents-styles/AdminPanel.css";

const DURATION_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "15", label: "15 days" },
  { value: "custom", label: "Custom input" },
];

const USER_REASON_PRESETS = [
  "Repeated policy violations",
  "Harassment or abusive language",
  "Spamming platform activity",
  "False or misleading information",
  "Suspicious or unsafe activity reported",
];

const DEFAULT_ACTION_STATE = {
  mode: null,
  duration: "3",
  customDays: "",
  reason: "",
  reasonError: false,
};

function formatDateTime(value) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No activity yet";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildActivityCopy(user) {
  const metrics = user?.metrics || {};

  if (user?.role === "ngo") {
    return [
      `${metrics.activeOpportunities || 0}/${metrics.totalOpportunities || 0} active opportunities`,
      `${metrics.completedPickupsHandled || 0}/${metrics.pickupsHandled || 0} pickups completed`,
    ];
  }

  return [
    `${metrics.acceptedApplications || 0}/${metrics.totalApplications || 0} accepted applications`,
    `${metrics.completedPickups || 0}/${metrics.scheduledPickups || 0} pickups completed`,
  ];
}

function getModerationStatus(user) {
  if (user?.moderationStatus) {
    return user.moderationStatus;
  }

  if (user?.accountStatus === "suspended") {
    return "suspended";
  }

  if (user?.restrictedUntil) {
    const restrictedUntil = new Date(user.restrictedUntil);
    if (!Number.isNaN(restrictedUntil.getTime()) && restrictedUntil > new Date()) {
      return "restricted";
    }
  }

  return "active";
}

function AdminSummaryCard({ title, value, helper, active, tone, onClick }) {
  return (
    <button
      type="button"
      className={`admin-summary-card ${tone || ""} ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </button>
  );
}

export default function AdminPanel() {
  const { data: me, isLoading: meLoading } = useMe();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState({
    open: false,
    type: "info",
    message: "",
    closing: false,
  });
  const [actionByUser, setActionByUser] = useState({});
  const [submittingUserId, setSubmittingUserId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/admin/overview`, {
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load admin overview");
      }

      return res.json();
    },
    enabled: !!me && me.role === "admin",
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const refreshOverview = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] }).catch(() => {});
    };

    socket.on("opportunity:created", refreshOverview);
    socket.on("opportunity:updated", refreshOverview);
    socket.on("opportunity:deleted", refreshOverview);
    socket.on("pickup:created", refreshOverview);
    socket.on("pickup:accepted", refreshOverview);
    socket.on("pickup:completed", refreshOverview);
    socket.on("pickup:updated", refreshOverview);
    socket.on("pickup:deleted", refreshOverview);
    socket.on("application:status-changed", refreshOverview);
    socket.on("admin:moderation-updated", refreshOverview);

    return () => {
      socket.off("opportunity:created", refreshOverview);
      socket.off("opportunity:updated", refreshOverview);
      socket.off("opportunity:deleted", refreshOverview);
      socket.off("pickup:created", refreshOverview);
      socket.off("pickup:accepted", refreshOverview);
      socket.off("pickup:completed", refreshOverview);
      socket.off("pickup:updated", refreshOverview);
      socket.off("pickup:deleted", refreshOverview);
      socket.off("application:status-changed", refreshOverview);
      socket.off("admin:moderation-updated", refreshOverview);
    };
  }, [queryClient]);

  const summary = data?.summary || {};
  const users = data?.users || [];
  const logs = data?.logs || [];

  const getActionState = (userId) => actionByUser[userId] || DEFAULT_ACTION_STATE;

  const showMessage = (message, type = "info", duration = 3200) => {
    setNotification({
      open: true,
      type,
      message,
      closing: false,
    });

    window.setTimeout(() => {
      setNotification((current) => ({
        ...current,
        closing: true,
      }));

      window.setTimeout(() => {
        setNotification({
          open: false,
          type: "info",
          message: "",
          closing: false,
        });
      }, 300);
    }, duration);
  };

  const updateActionState = (userId, patch) => {
    setActionByUser((prev) => ({
      ...prev,
      [userId]: {
        ...DEFAULT_ACTION_STATE,
        ...(prev[userId] || {}),
        ...patch,
      },
    }));
  };

  const openActionEditor = (userId, mode) => {
    const current = getActionState(userId);
    updateActionState(userId, {
      mode,
      duration: current.duration || "3",
      customDays: current.customDays || "",
      reason: current.reason || "",
      reasonError: false,
    });
  };

  const closeActionEditor = (userId) => {
    setActionByUser((prev) => ({
      ...prev,
      [userId]: { ...DEFAULT_ACTION_STATE },
    }));
  };

  const togglePresetReason = (userId, reason) => {
    const current = getActionState(userId);
    updateActionState(userId, {
      reason: current.reason === reason ? "" : reason,
      reasonError: false,
    });
  };

  const handleModerationAction = async (user, mode) => {
    const userId = user._id || user.id;
    const current = getActionState(userId);
    const trimmedReason = (current.reason || "").trim();

    if (!trimmedReason) {
      updateActionState(userId, { reasonError: true });
      return;
    }

    const resolvedDays =
      current.duration === "custom"
        ? Number(current.customDays)
        : Number(current.duration);

    if (!Number.isFinite(resolvedDays) || resolvedDays < 1) {
      showMessage(
        "Enter a valid number of days before submitting this action.",
        "error"
      );
      return;
    }

    setSubmittingUserId(String(userId));

    try {
      const endpoint = mode === "restrict" ? "restrict" : "suspend";
      const res = await fetch(`${API_BASE}/admin/users/${userId}/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationDays: resolvedDays,
          reason: trimmedReason,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to update the user status");
      }

      showMessage(
        payload.message ||
          (mode === "restrict"
            ? "User restricted successfully."
            : "User suspended successfully."),
        "success"
      );
      closeActionEditor(userId);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      showMessage(
        err instanceof Error
          ? err.message
          : "Failed to update the user status.",
        "error"
      );
    } finally {
      setSubmittingUserId("");
    }
  };

  const handleRestore = async (user) => {
    const userId = user._id || user.id;
    setSubmittingUserId(String(userId));

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/restore`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to restore access");
      }

      showMessage(
        payload.message || "User access restored successfully.",
        "success"
      );
      closeActionEditor(userId);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Failed to restore access.",
        "error"
      );
    } finally {
      setSubmittingUserId("");
    }
  };

  const filteredUsers = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const moderationStatus = getModerationStatus(user);
      const matchesStatus =
        statusFilter === "all" || moderationStatus === statusFilter;
      const matchesSearch =
        !searchLower ||
        String(user.username || "").toLowerCase().includes(searchLower);

      return matchesStatus && matchesSearch;
    });
  }, [searchTerm, statusFilter, users]);

  const summaryCards = [
    {
      key: "all",
      title: "Total users",
      value: summary.totalUsers || 0,
      helper: "Show every monitored account in review.",
      tone: "",
    },
    {
      key: "active",
      title: "Active accounts",
      value: summary.activeUsers || 0,
      helper: "Users with no active restriction or suspension.",
      tone: "",
    },
    {
      key: "restricted",
      title: "Restricted users",
      value: summary.restrictedUsers || 0,
      helper: "Temporary feature limits currently in effect.",
      tone: "info",
    },
    {
      key: "suspended",
      title: "Suspended users",
      value: summary.suspendedUsers || 0,
      helper: "Accounts fully paused by admin review.",
      tone: "warning",
    },
  ];

  if (meLoading) {
    return (
      <div className="page admin-logs-page">
        <div className="page-header-wrapper">
          <h1 className="page-header">Admin Logs</h1>
          <p className="page-subtitle">Loading admin workspace...</p>
        </div>
      </div>
    );
  }

  if (me?.role !== "admin") {
    return (
      <div className="page admin-logs-page">
        <div className="page-header-wrapper">
          <h1 className="page-header">Admin Logs</h1>
          <p className="page-subtitle">
            This page is only available to the WasteZero admin account.
          </p>
        </div>
        <div className="admin-restricted-card">
          <h3>Access restricted</h3>
          <p>Use the standard role pages for volunteer or NGO activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page admin-logs-page">
      <div className="page-header-wrapper">
        <h1 className="page-header">Admin Logs</h1>
        <p className="page-subtitle">
          Review user behavior, monitor account status, and take action without
          leaving the moderation workspace.
        </p>
      </div>

      {error ? (
        <div className="admin-restricted-card">
          <h3>Unable to load admin tools</h3>
          <p>
            {error instanceof Error
              ? error.message
              : "Something went wrong while loading admin tools."}
          </p>
        </div>
      ) : (
        <>
          <div className="admin-summary-grid">
            {summaryCards.map((card) => (
              <AdminSummaryCard
                key={card.key}
                title={card.title}
                value={card.value}
                helper={card.helper}
                tone={card.tone}
                active={statusFilter === card.key}
                onClick={() => {
                  if (card.key === "all") {
                    setStatusFilter("all");
                    return;
                  }

                  setStatusFilter((prev) =>
                    prev === card.key ? "all" : card.key
                  );
                }}
              />
            ))}
          </div>

          <div className="admin-layout-grid">
            <section className="admin-section admin-users-section">
              <div className="admin-section-head admin-section-head-row">
                <div>
                  <h2>User behavior review</h2>
                  <p>
                    {summary.totalUsers || 0} users monitored,{" "}
                    {summary.totalLogs || 0} admin actions recorded.
                  </p>
                </div>
                <div className="admin-review-tools">
                  <div className="admin-search-wrap">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by username"
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-filter-reset"
                    onClick={() => {
                      setStatusFilter("all");
                      setSearchTerm("");
                    }}
                  >
                    Show all
                  </button>
                </div>
              </div>

              {statusFilter !== "all" && (
                <div className="admin-inline-filter">
                  Showing {statusFilter} users
                </div>
              )}

              {isLoading ? (
                <div className="admin-empty-state">Loading user activity...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="admin-empty-state">
                  No users match the current review filters.
                </div>
              ) : (
                <div className="admin-user-grid">
                  {filteredUsers.map((user) => {
                    const userId = user._id || user.id;
                    const moderationStatus = getModerationStatus(user);
                    const activityLines = buildActivityCopy(user);
                    const actionState = getActionState(userId);
                    const canRestrict = moderationStatus === "active";
                    const canSuspend = moderationStatus !== "suspended";
                    const isEditing =
                      Boolean(actionState.mode) &&
                      ((actionState.mode === "restrict" && canRestrict) ||
                        (actionState.mode === "suspend" && canSuspend));
                    const isSubmitting = submittingUserId === String(userId);

                    return (
                      <article key={userId} className="admin-user-card">
                        <div className="admin-user-top">
                          <div>
                            <h3>{user.fullName}</h3>
                            <p>@{user.username}</p>
                          </div>
                          <div className="admin-user-badges">
                            <span className={`admin-role-badge ${user.role}`}>
                              {user.role}
                            </span>
                            <span
                              className={`admin-status-badge ${moderationStatus}`}
                            >
                              {moderationStatus.charAt(0).toUpperCase() +
                                moderationStatus.slice(1)}
                            </span>
                          </div>
                        </div>

                        <p className="admin-user-email">{user.email}</p>

                        <div className="admin-metric-list">
                          {activityLines.map((line) => (
                            <span key={line} className="admin-metric-pill">
                              {line}
                            </span>
                          ))}
                        </div>

                        <div className="admin-user-meta">
                          <span>Joined: {formatDateTime(user.createdAt)}</span>
                          <span>
                            Last activity: {formatDateTime(user.lastActivityAt)}
                          </span>
                          {moderationStatus === "restricted" && (
                            <span>
                              Restricted until:{" "}
                              {formatDateTime(user.restrictedUntil)}
                            </span>
                          )}
                          {moderationStatus === "suspended" && (
                            <span>
                              Suspended until:{" "}
                              {formatDateTime(user.suspendedUntil)}
                            </span>
                          )}
                        </div>

                        <div className="admin-user-actions">
                          {canRestrict && (
                            <ActionButton
                              type="button"
                              icon="restrict"
                              tone={actionState.mode === "restrict" ? "warning" : "neutral"}
                              size="sm"
                              minWidth={180}
                              onClick={() => openActionEditor(userId, "restrict")}
                              disabled={isSubmitting}
                            >
                              Restrict User
                            </ActionButton>
                          )}
                          {canSuspend && (
                            <ActionButton
                              type="button"
                              icon="suspend"
                              tone="danger"
                              size="sm"
                              minWidth={180}
                              onClick={() => openActionEditor(userId, "suspend")}
                              disabled={isSubmitting}
                            >
                              Suspend User
                            </ActionButton>
                          )}
                          {moderationStatus !== "active" && (
                            <button
                              type="button"
                              className="admin-action-btn restore"
                              onClick={() => handleRestore(user)}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? "Updating..." : "Restore Access"}
                            </button>
                          )}
                        </div>

                        {isEditing && (
                          <div className="admin-moderation-panel">
                            <div className="admin-moderation-grid">
                              <div className="admin-field">
                                <label>Days</label>
                                <select
                                  className="admin-duration-select"
                                  value={actionState.duration}
                                  onChange={(e) =>
                                    updateActionState(userId, {
                                      duration: e.target.value,
                                    })
                                  }
                                >
                                  {DURATION_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                {actionState.duration === "custom" && (
                                  <input
                                    type="number"
                                    min="1"
                                    className="admin-custom-days"
                                    value={actionState.customDays}
                                    onChange={(e) =>
                                      updateActionState(userId, {
                                        customDays: e.target.value,
                                      })
                                    }
                                    placeholder="Enter custom days"
                                  />
                                )}
                              </div>

                              <div className="admin-field admin-field-grow">
                                <label>Reason</label>
                                <input
                                  type="text"
                                  className={`admin-reason-input ${
                                    actionState.reasonError ? "error" : ""
                                  }`}
                                  value={actionState.reason}
                                  onChange={(e) =>
                                    updateActionState(userId, {
                                      reason: e.target.value,
                                      reasonError: false,
                                    })
                                  }
                                  placeholder="Select or enter a reason"
                                />
                              </div>
                            </div>

                            <div className="admin-reason-presets">
                              {USER_REASON_PRESETS.map((reason) => {
                                const active = actionState.reason === reason;
                                return (
                                  <button
                                    key={reason}
                                    type="button"
                                    className={`admin-reason-chip ${
                                      active ? "active" : ""
                                    }`}
                                    onClick={() => togglePresetReason(userId, reason)}
                                  >
                                    {active ? `Remove: ${reason}` : reason}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="admin-moderation-actions">
                              <button
                                type="button"
                                className={`admin-action-btn ${
                                  actionState.mode === "suspend"
                                    ? "danger"
                                    : "confirm"
                                }`}
                                onClick={() =>
                                  handleModerationAction(user, actionState.mode)
                                }
                                disabled={isSubmitting}
                              >
                                {isSubmitting
                                  ? "Submitting..."
                                  : actionState.mode === "restrict"
                                    ? "Restrict User"
                                    : "Suspend User"}
                              </button>
                              <button
                                type="button"
                                className="admin-action-btn secondary"
                                onClick={() => closeActionEditor(userId)}
                                disabled={isSubmitting}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="admin-section admin-log-section">
              <div className="admin-section-head">
                <div>
                  <h2>Recent admin actions</h2>
                  <p>Latest entries saved in the admin log collection.</p>
                </div>
              </div>

              {isLoading ? (
                <div className="admin-empty-state">Loading admin logs...</div>
              ) : logs.length === 0 ? (
                <div className="admin-empty-state">
                  No admin actions have been recorded yet.
                </div>
              ) : (
                <div className="admin-log-list">
                  {logs.map((log) => (
                    <div
                      key={log._id || `${log.action}-${log.timestamp}`}
                      className="admin-log-item"
                    >
                      <div className="admin-log-dot" />
                      <div className="admin-log-content">
                        <p className="admin-log-action">{log.action}</p>
                        <div className="admin-log-meta">
                          <span>
                            {log.user_id?.fullName ||
                              log.user_id?.username ||
                              "Unknown user"}
                          </span>
                          <span>{formatDateTime(log.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {notification.open && (
        <MessageBox
          message={notification.message}
          type={notification.type}
          closing={notification.closing}
        />
      )}
    </div>
  );
}
