import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, useMe } from "../Services/useMe";
import {
  clearConversationNotifications,
  markNotificationRead,
  mergeNotificationIntoCache,
  notificationsQueryKey,
  updateApplicationStatusInNotificationCache,
  useNotifications,
} from "../Services/useNotifications";
import MessageBox from "./MessageBox";
import ConfirmDialog from "./ConfirmDialog";
import ActionButton from "./ActionButton";
import { useQueryClient } from "@tanstack/react-query";

const MESSAGE_SUBJECTS = new Set([
  "User Report",
  "ACCOUNT SUSPENSION",
  "ACCOUNT RESTRICTION",
]);

const extractMessageSubject = (content = "") => {
  const firstLine = String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "";
  }

  return MESSAGE_SUBJECTS.has(firstLine) ? firstLine : "";
};

export const truncateNotificationPreview = (content = "") => {
  const lines = String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  const words = lines[0].split(/\s+/).filter(Boolean);
  if (lines.length === 1 && words.length <= 5) {
    return lines[0];
  }

  return `${words.slice(0, 5).join(" ")} .....`;
};

export function formatNotification(n, currentUser) {
  let formatted;

  switch (n.type) {
    case "pickup_completed":
      formatted = {
        title: "Pickup is Completed",
        body: `Click to open.`
      };
      break;
    case "pickup_accepted":
      formatted = {
        title: "Your Pickup is Accepted",
        body: `By ${n.meta?.sender_id?.fullName || 'an NGO'}`
      };
      break;
    case "message": {
      const senderName = n._message?.sender_id?.fullName || n.meta?.senderName || "Someone";
      let content = n._message?.content || n.meta?.message || "";
      const subject = n.meta?.messageSubject || extractMessageSubject(content);
      if (currentUser?.role === "admin" && subject === "User Report") {
        formatted = { title: subject, body: "" };
        break;
      }
      if (!content && n._message?.attachments?.length > 0) {
        const t = n._message.attachments[0].type;
        content = t === 'image' ? '📷 Photo' : t === 'audio' ? '🎵 Audio' : '📄 File';
      }
      formatted = { title: "New Message", body: `${senderName}: ${content}` };
      break;
    }
    case "application":
      formatted = {
        title: "New Application",
        body: `You received a new application for ${(n.application?.opportunityId?.title) || n.meta?.title || "Opportunity"}`
      };
      break;
    case "accepted":
    case "rejected":
      formatted = {
        title: `Application ${n.type}`,
        body: `Your ${(n.application?.opportunityId?.title) || n.meta?.title || "application"} was ${n.type}`
      };
      break;
    default:
      formatted = {
        title: n.title || "Notification",
        body: n.body || n.meta?.message || "You have a new update"
      };
      break;
  }

  return {
    ...formatted,
    body: truncateNotificationPreview(formatted?.body || ""),
  };
}

export default function NotificationPanel() {
  const { data: me } = useMe();
  const { data: notifications = [], isLoading: loading } = useNotifications();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [notification, setNotification] = useState({ open: false, message: "", type: "info", closing: false });
  const [removingIds, setRemovingIds] = useState([]);
  const removalTimersRef = useRef([]);

  const showMessage = (msg, type = "info", duration = 3000) => {
    setNotification({ open: true, message: msg, type, closing: false });
    window.setTimeout(() => {
      setNotification((s) => ({ ...s, closing: true }));
      window.setTimeout(() => setNotification({ open: false, message: "", type: "info", closing: false }), 300);
    }, duration);
  };

  useEffect(() => {
    const handleIncoming = (e) => {
      const payload = e.detail;
      if (payload && payload.id && payload.type) {
        mergeNotificationIntoCache(queryClient, payload);
      }
    };

    window.addEventListener("notify:incoming", handleIncoming);
    return () => window.removeEventListener("notify:incoming", handleIncoming);
  }, [queryClient]);

  useEffect(() => {
    return () => {
      removalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      removalTimersRef.current = [];
    };
  }, []);

  const markRead = async (id) => {
    await markNotificationRead(queryClient, id);
  };

  const animateNotificationClear = (id, callback = markRead) => {
    setRemovingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

    const timer = window.setTimeout(async () => {
      try {
        await callback(id);
      } finally {
        setRemovingIds((prev) => prev.filter((itemId) => itemId !== id));
      }
    }, 220);

    removalTimersRef.current.push(timer);
  };

  const [selectedNotif, setSelectedNotif] = useState(null);
  const openNotification = async (n) => {
    // Pickup notifications: navigate + delete from DB
    if (n.type === 'pickup_completed' || n.type === 'pickup_accepted') {
      const pickupId = n.meta?.pickupId || (n.referenceId ? String(n.referenceId) : null);
      markRead(n._id).catch(() => { });
      try { window.dispatchEvent(new CustomEvent('notify:close-panel')); } catch (e) { }
      if (pickupId) {
        const celebrate = n.type === 'pickup_completed' ? '&celebrate=1' : '';
        navigate(`/home/schedule?tab=history&pickupId=${pickupId}${celebrate}`);
      } else {
        navigate('/home/schedule?tab=history');
      }
      return;
    }

    // open modal for application related notifications if application data exists
    if (n.type === 'application' || n.type === 'accepted' || n.type === 'rejected') {
      let resolvedNotification = n;

      if (!resolvedNotification.application) {
        const appId = resolvedNotification.application_id || resolvedNotification.referenceId;
        if (appId) {
          try {
            const response = await fetch(`${API_BASE}/applications/${appId}`, { credentials: "include" });
            if (response.ok) {
              const application = await response.json();
              resolvedNotification = {
                ...resolvedNotification,
                application,
              };
              mergeNotificationIntoCache(queryClient, resolvedNotification);
            }
          } catch (e) { }
        }
      }

      if (resolvedNotification.application) {
        setSelectedNotif(resolvedNotification);
      }

      // For NGOs, don't automatically clear application notifications just by clicking.
      // They should clear only when a decision (Accept/Reject) is made or manually cleared.
      const isNgoApp = me && me.role === 'ngo' && n.type === 'application';
      if (!isNgoApp && !n.read) {
        markRead(n._id).catch(() => { });
      }
    } else {
      // If it's a message notification, navigate to Messages and clear related notifs.
      if (n.type === 'message' && n.referenceId) {
        (async () => {
          try {
            // fetch message to obtain conversationId
            const r = await fetch(`${API_BASE}/api/chat/messages/${n.referenceId}`, { credentials: 'include' });
            if (r.ok) {
              const msg = await r.json();
              const convId = msg.conversationId;
              // mark this notification read
              if (!n.read) await markRead(n._id);
              // clear other notifications for this conversation
              try {
                await clearConversationNotifications(queryClient, convId);
              } catch (e) { }
              // close notification panel (ask Topbar to hide it), then navigate
              try { window.dispatchEvent(new CustomEvent('notify:close-panel')); } catch (e) { }
              navigate('/home/messages', { state: { openConversationId: convId } });
            } else {
              // fallback: just mark read
              if (!n.read) markRead(n._id).catch(() => { });
            }
          } catch (err) {
            if (!n.read) markRead(n._id).catch(() => { });
          }
        })();
        return;
      }

      // fallback for non-message notifications: mark read
      if (!n.read) markRead(n._id).catch(() => { });
    }
  };

  const handleResponse = async (applicationId, notificationId, status) => {
    try {
      const res = await fetch(`${API_BASE}/applications/${applicationId}/respond`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to respond");

      updateApplicationStatusInNotificationCache(queryClient, applicationId, status, notificationId);

      // For NGOs, cleared the notification from the server now that action is taken
      if (notificationId) {
        await markRead(notificationId);
      }

    } catch (err) {
      showMessage(err.message || "Failed to send response", "error");
    }
  };

  const closePanel = () => {
    try {
      window.dispatchEvent(new CustomEvent("notify:close-panel"));
    } catch (e) { }
  };

  return (
    <div className="notification-panel" style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingBottom: 10, position: "sticky", top: 0, background: "var(--surface-primary)", zIndex: 2 }}>
        
      </div>

      {loading && <div style={{ padding: 12, color: "var(--text-secondary)" }}>Loading...</div>}
      {!loading && notifications.length === 0 && (
        <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>You're all caught up</span>
          <small>No new notifications right now.</small>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.map((n) => (
          <div
            key={n._id}
            style={{
              overflow: 'hidden',
              maxHeight: removingIds.includes(n._id) ? 0 : 180,
              opacity: removingIds.includes(n._id) ? 0 : 1,
              transform: removingIds.includes(n._id) ? 'translateX(42px) scale(0.96)' : 'translateX(0) scale(1)',
              transition: 'max-height 0.24s ease, opacity 0.24s ease, transform 0.24s ease',
              pointerEvents: removingIds.includes(n._id) ? 'none' : 'auto',
            }}
          >
          <div key={n._id} style={{ padding: 12, borderRadius: 10, background: n.read ? 'var(--surface-secondary)' : 'var(--surface-primary)', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.2s ease' }} onClick={() => openNotification(n)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                {(() => {
                  const { title, body } = formatNotification(n, me);
                  return (
                    <div>
                      <div style={{ fontWeight: 700 }}>{title}</div>
                      {body ? (
                        <div style={{ fontWeight: 500, marginTop: 6, color: 'var(--text-secondary)' }}>{body}</div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {(n.type === 'application' || n.type === 'accepted' || n.type === 'rejected' || !n.read) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); animateNotificationClear(n._id); }}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'var(--primary)',
                      color: 'var(--text-inverse)',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                )}

                {/* show action buttons for NGO on application notifications */}
                {n.type === 'application' && n.application && me && me.role === 'ngo' && n.application.opportunityId && String(n.application.opportunityId.ngo_id) === String(me.id) && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(!n.application.status || n.application.status === 'pending') && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleResponse(n.application._id, n._id, 'accepted'); }} style={{ background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', padding: '6px 8px', borderRadius: 6 }}>Accept</button>
                        <button onClick={(e) => { e.stopPropagation(); handleResponse(n.application._id, n._id, 'rejected'); }} style={{ background: 'var(--danger)', color: 'var(--text-inverse)', border: 'none', padding: '6px 8px', borderRadius: 6 }}>Reject</button>
                      </>
                    )}
                    {n.application.status && n.application.status !== 'pending' && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{n.application.status}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        ))}
      </div>
      {selectedNotif && (
        me && me.role === 'ngo' ? (
          <ApplicationModal
            notif={selectedNotif}
            onClose={() => setSelectedNotif(null)}
            onAction={async (applicationId, status) => {
              // call respond endpoint and update local UI
              await handleResponse(applicationId, selectedNotif._id, status);
              setSelectedNotif((s) => s ? { ...s, application: { ...(s.application || {}), status } } : s);
            }}
          />
        ) : (
          <VolunteerApplicationModal
            notif={selectedNotif}
            onClose={() => setSelectedNotif(null)}
            onAction={() => queryClient.invalidateQueries({ queryKey: notificationsQueryKey })}
            onNotify={showMessage}
          />
        )
      )}
      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
    </div>
  );
}

const getModalOpportunity = (app) => {
  let opp = app?.opportunityId || {};

  if (opp && typeof opp === "object") {
    const desc = opp.description || "";
    const match = desc.match(/\(Date:\s*([^\)]+)\)\s*$/);
    if (match) {
      const extracted = match[1].trim();
      opp = {
        ...opp,
        description: desc.replace(/\s*\(Date:\s*[^\)]+\)\s*$/, "").trim(),
        date: opp.date || extracted,
      };
    }
  }

  return opp;
};

const getModalLocationText = (opp) => {
  if (!opp) return "N/A";
  if (opp.city) return opp.city;
  if (typeof opp.location === "string") return opp.location;
  if (opp.location?.type === "Point" && Array.isArray(opp.location.coordinates)) {
    return `Lat: ${opp.location.coordinates[0]}, Lon: ${opp.location.coordinates[1]}`;
  }
  return "N/A";
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "var(--overlay-scrim)",
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1200,
  padding: "20px",
};

const modalCardStyle = {
  width: "min(860px, 100%)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "var(--surface-primary)",
  borderRadius: "28px",
  boxShadow: "var(--shadow-strong)",
  border: "1px solid var(--border-color)",
};

const buildHeroStyle = (imageUrl) => ({
  padding: "26px",
  background: imageUrl
    ? `linear-gradient(180deg, rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.82)), url(${imageUrl}) center/cover no-repeat`
    : "linear-gradient(135deg, rgba(8, 193, 138, 0.94), rgba(15, 118, 110, 0.88))",
  color: "#ffffff",
});

const buildStatusStyles = (statusColor, isDeleted = false) => ({
  wrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "38px",
    padding: "0 16px",
    borderRadius: "999px",
    background: isDeleted ? "var(--surface-secondary)" : `${statusColor}18`,
    color: isDeleted ? "var(--text-secondary)" : statusColor,
    border: `1px solid ${isDeleted ? "var(--border-color)" : `${statusColor}44`}`,
    fontWeight: 800,
    textTransform: "capitalize",
    letterSpacing: "0.02em",
    fontSize: "13px",
  },
});

const buildStatusTextStyle = (statusColor, isDeleted = false) => ({
  margin: 0,
  color: isDeleted ? "var(--text-secondary)" : statusColor,
  fontWeight: 800,
  fontSize: "28px",
  lineHeight: 1,
  textTransform: "capitalize",
  letterSpacing: "0.01em",
});

const modalSectionCardStyle = {
  border: "1px solid var(--border-color)",
  borderRadius: "20px",
  padding: "18px 20px",
  background: "var(--surface-secondary)",
  boxShadow: "var(--shadow-soft)",
};

const modalMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

export function ApplicationModal({ notif, onClose, onAction }) {
  const [actionLoading, setActionLoading] = useState("");
  const app = notif?.application;
  if (!app) return null;
  const opp = getModalOpportunity(app);
  const vol = app.volunteerId || {};
  const status = (app.status || "pending").toLowerCase();
  const statusColor = status === "accepted" ? "#08C18A" : status === "rejected" ? "#ff3b30" : "#f0ad4e";
  const statusStyles = buildStatusStyles(statusColor);

  const handleAction = async (nextStatus) => {
    if (!onAction || actionLoading) return;
    setActionLoading(nextStatus);
    try {
      await Promise.resolve(onAction(app._id, nextStatus));
    } finally {
      setActionLoading("");
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={() => {
      if (!actionLoading) {
        onClose?.();
      }
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalCardStyle, position: "relative" }}>
        {actionLoading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15, 23, 42, 0.34)", borderRadius: "28px" }}>
            <div style={{ color: "var(--text-inverse)", fontWeight: 800, fontSize: "18px" }}>
              {actionLoading === "accepted" ? "Accepting application..." : "Rejecting application..."}
            </div>
          </div>
        )}
        <div style={buildHeroStyle(opp.img_link)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "10px" }}>
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.9, fontWeight: 700 }}>
                Volunteer application
              </span>
              <h2 style={{ margin: 0, fontSize: "30px", lineHeight: 1.1 }}>{opp.title || "New Application"}</h2>
              <p style={{ margin: 0, maxWidth: "60ch", color: "rgba(255,255,255,0.92)", lineHeight: 1.7, fontSize: "14px" }}>
                {opp.description || "Review the submitted application and decide whether to accept or reject it."}
              </p>
            </div>
            <div style={statusStyles.wrap}>{status}</div>
          </div>
        </div>

        <div style={{ padding: "24px", display: "grid", gap: "18px" }}>
          <div style={modalMetaGridStyle}>
            <div style={modalSectionCardStyle}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
                Event details
              </div>
              <div style={{ display: "grid", gap: "10px", color: "var(--text-primary)" }}>
                <div><strong>Date:</strong> {opp.date || "N/A"}</div>
                <div><strong>Location:</strong> {getModalLocationText(opp)}</div>
                <div><strong>Duration:</strong> {opp.duration ? `${opp.duration} Hours` : "N/A"}</div>
              </div>
            </div>

            <div style={modalSectionCardStyle}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
                Applicant
              </div>
              <div style={{ display: "grid", gap: "10px", color: "var(--text-primary)" }}>
                <div><strong>Name:</strong> {vol.fullName || "N/A"}</div>
                <div><strong>Email:</strong> {vol.email || "N/A"}</div>
              </div>
            </div>
          </div>

          <div style={{ ...modalSectionCardStyle, background: "var(--surface-primary)" }}>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
              Opportunity description
            </div>
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.75, fontSize: "15px" }}>
              {opp.description || "No additional description was provided for this opportunity."}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap", paddingTop: "6px" }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                Application status
              </span>
              <div style={statusStyles.wrap}>{status}</div>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {status === "pending" && (
                <>
                  <ActionButton
                    type="button"
                    icon="check"
                    tone="primary"
                    minWidth={170}
                    onClick={() => handleAction("accepted")}
                    disabled={Boolean(actionLoading)}
                  >
                    {actionLoading === "accepted" ? "Accepting..." : "Accept"}
                  </ActionButton>
                  <ActionButton
                    type="button"
                    icon="close"
                    tone="danger"
                    minWidth={170}
                    onClick={() => handleAction("rejected")}
                    disabled={Boolean(actionLoading)}
                  >
                    {actionLoading === "rejected" ? "Rejecting..." : "Reject"}
                  </ActionButton>
                </>
              )}
              <ActionButton
                type="button"
                icon="back"
                tone="neutral"
                minWidth={150}
                onClick={onClose}
                disabled={Boolean(actionLoading)}
              >
                Close
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VolunteerApplicationModal({ notif, onClose, onAction, onNotify }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const app = notif?.application;
  if (!app) return null;
  const opp = getModalOpportunity(app);
  const isDeleted = !app.opportunityId || (typeof app.opportunityId === "object" && !app.opportunityId._id);
  const status = (app.status || "pending").toLowerCase();
  const statusColor = status === "accepted" ? "#0bbd66" : status === "rejected" ? "#e74c3c" : "#f0ad4e";
  const statusTextStyle = buildStatusTextStyle(statusColor, isDeleted);
  const statusLabel = isDeleted ? "Expired / Deleted" : status;

  const handleDeleteClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setConfirming(true);
    let notifyMessage = "";
    let notifyType = "info";
    let shouldRefresh = false;

    try {
      const res = await fetch(`${API_BASE}/applications/${app._id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        notifyMessage = status === "pending" ? "Application withdrawn successfully." : "Application record deleted.";
        notifyType = "success";
        shouldRefresh = true;
      } else {
        const data = await res.json();
        notifyMessage = data.message || "Failed to remove application";
        notifyType = "error";
      }
    } catch (err) {
      notifyMessage = "Failed to remove application";
      notifyType = "error";
    }

    setConfirming(false);
    setConfirmOpen(false);
    onClose?.();

    if (shouldRefresh && onAction) {
      try {
        await Promise.resolve(onAction());
      } catch (e) { }
    }

    if (notifyMessage && onNotify) {
      window.setTimeout(() => onNotify(notifyMessage, notifyType), 0);
    }
  };

  const confirmMsg = status === "pending"
    ? "Are you sure you want to withdraw your application ?"
    : "Are you sure you want to delete this application record?";

  return (
    <div style={{ ...modalOverlayStyle, zIndex: 1000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalCardStyle, position: "relative" }}>
        {confirming && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.35)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "28px" }}>
            <div style={{ color: "var(--text-inverse)", fontWeight: 700, fontSize: 20 }}>Processing request...</div>
          </div>
        )}

        <div style={buildHeroStyle(!isDeleted ? opp.img_link : null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: "10px" }}>
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.9, fontWeight: 700 }}>
                My application
              </span>
              <h2 style={{ margin: 0, fontSize: "30px", lineHeight: 1.1 }}>
                {isDeleted ? "Opportunity no longer available" : (opp.title || "Application details")}
              </h2>
              <p style={{ margin: 0, maxWidth: "62ch", color: "rgba(255,255,255,0.92)", lineHeight: 1.7, fontSize: "14px" }}>
                {isDeleted
                  ? "The NGO removed this opportunity. You can keep the record or delete it from your history."
                  : (opp.description || "Review the opportunity details and track your current application status.")}
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: "24px", display: "grid", gap: "18px" }}>
          {isDeleted ? (
            <div style={modalMetaGridStyle}>
              <div style={{ ...modalSectionCardStyle, background: "var(--surface-danger-soft)", borderStyle: "dashed" }}>
                <h3 style={{ color: "var(--danger)", margin: "0 0 8px", fontSize: "22px" }}>This opportunity was deleted by the NGO</h3>
                <p style={{ color: "var(--text-secondary)", margin: 0, lineHeight: 1.7 }}>
                  You can delete this application request to clear your history.
                </p>
              </div>

              <div style={modalSectionCardStyle}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
                  Application status
                </div>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={statusTextStyle}>{statusLabel}</div>
                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.7, fontSize: "14px" }}>
                    This record is preserved for reference, but the original opportunity is no longer available.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={modalMetaGridStyle}>
                <div style={modalSectionCardStyle}>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
                    Event details
                  </div>
                  <div style={{ display: "grid", gap: "10px", color: "var(--text-primary)" }}>
                    <div><strong>Date:</strong> {opp.date || "N/A"}</div>
                    <div><strong>Location:</strong> {getModalLocationText(opp)}</div>
                    <div><strong>Duration:</strong> {opp.duration ? `${opp.duration} Hours` : "N/A"}</div>
                    </div>
                </div>

                <div style={modalSectionCardStyle}>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
                    Application status
                  </div>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div style={statusTextStyle}>{statusLabel}</div>
                    <div style={{ color: "var(--text-secondary)", lineHeight: 1.7, fontSize: "14px" }}>
                      {status === "accepted"
                        ? "Your application has been accepted."
                        : status === "rejected"
                          ? "This application was rejected."
                          : "This application is still pending review."}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ ...modalSectionCardStyle, background: "var(--surface-primary)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "12px" }}>
                  Opportunity description
                </div>
                <div style={{ color: "var(--text-secondary)", lineHeight: 1.75, fontSize: "15px" }}>
                  {opp.description || "No additional description was provided for this opportunity."}
                </div>
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <ActionButton
              type="button"
              icon="back"
              tone="neutral"
              minWidth={150}
              onClick={onClose}
              disabled={confirming}
            >
              Back
            </ActionButton>

            {(status !== "accepted" || isDeleted) && (
              <ActionButton
                type="button"
                icon="delete"
                tone="danger"
                minWidth={210}
                onClick={handleDeleteClick}
                disabled={confirming}
              >
                {status === "pending" ? "Withdraw Application" : "Delete Application"}
              </ActionButton>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          message={confirmMsg}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmOpen(false)}
          confirmLabel={status === "pending" ? "Withdraw" : "Delete"}
          cancelLabel="Keep it"
          confirming={confirming}
          danger={true}
          buttonType="delete"
        />
      </div>
    </div>
  );
}




