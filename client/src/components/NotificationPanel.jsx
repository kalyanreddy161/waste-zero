import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, useMe } from "../Services/useMe";
import MessageBox from "./MessageBox";
import ConfirmDialog from "./ConfirmDialog";

export default function NotificationPanel() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [notification, setNotification] = useState({ open: false, message: "", type: "info", closing: false });

  const showMessage = (msg, type = "info", duration = 3000) => {
    setNotification({ open: true, message: msg, type, closing: false });
    window.setTimeout(() => {
      setNotification((s) => ({ ...s, closing: true }));
      window.setTimeout(() => setNotification({ open: false, message: "", type: "info", closing: false }), 300);
    }, duration);
  };

  // Helper to normalize an opportunity: extract `(Date: YYYY-MM-DD)` suffix
  // from description into a `date` field and trim the description.
  const normalizeOpportunity = (opp) => {
    if (!opp) return opp;
    const copy = { ...opp };
    const desc = copy.description || "";
    const m = desc.match(/\(Date:\s*([^\)]+)\)\s*$/);
    if (m) {
      const extracted = m[1].trim();
      copy.description = desc.replace(/\s*\(Date:\s*[^\)]+\)\s*$/, "").trim();
      copy.date = copy.date || extracted;
    }
    return copy;
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // fetch notifications and enrich application-type notifications with application data
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/notifications`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      // fetch application details for relevant notifications
      const enriched = await Promise.all(
        list.map(async (n) => {
          // enrich message notifications with message + sender data
          if (n.type === 'message' && n.referenceId) {
            try {
              const r = await fetch(`${API_BASE}/api/chat/messages/${n.referenceId}`, { credentials: 'include' });
              if (r.ok) {
                const msg = await r.json();
                return { ...n, _message: msg };
              }
            } catch (e) { /* ignore */ }
          }
          const appId = n.application_id || (n.type !== "message" ? n.referenceId : null);
          if (appId && (n.type === "application" || n.type === "accepted" || n.type === "rejected")) {
            try {
              const r = await fetch(`${API_BASE}/applications/${appId}`, { credentials: "include" });
              if (!r.ok) return { ...n };
              const app = await r.json();
              if (app && app.opportunityId) {
                app.opportunityId = normalizeOpportunity(app.opportunityId);
              }
              return { ...n, application: app };
            } catch (e) {
              return { ...n };
            }
          }
          return { ...n };
        })
      );

      setNotifications(enriched);
    } catch (err) {
      console.error("fetchNotifications", err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: "PUT", credentials: "include" });
      if (res.ok) {
        // server deletes notification; remove from UI list
        setNotifications((prev) => prev.filter((n) => n._id !== id));
      }
    } catch (err) {
      console.error("markRead", err);
    }
  };

  const [selectedNotif, setSelectedNotif] = useState(null);
  const openNotification = (n) => {
    // open modal for application related notifications if application data exists
    if ((n.type === 'application' || n.type === 'accepted' || n.type === 'rejected') && n.application) {
      setSelectedNotif(n);

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
                await fetch(`${API_BASE}/notifications/clear-chat`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ conversationId: convId }),
                });
              } catch (e) { }
              // close notification panel (ask Topbar to hide it), then navigate
              try { window.dispatchEvent(new CustomEvent('notify:close-panel')); } catch (e) {}
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

      // update local notification/application status
      setNotifications((prev) => prev.map((n) => {
        if (n._id === notificationId) return { ...n, read: true, application: { ...(n.application || {}), status } };
        if (n.application && String(n.application._id) === String(applicationId)) return { ...n, application: { ...(n.application || {}), status } };
        return n;
      }));

      // For NGOs, cleared the notification from the server now that action is taken
      if (notificationId) {
        markRead(notificationId).catch(err => console.error("Auto-clearing notification failed:", err));
      }

      // optionally re-fetch notifications to keep consistent
      // await fetchNotifications();
    } catch (err) {
      console.error("handleResponse", err);
      showMessage(err.message || "Failed to send response", "error");
    }
  };

  return (
    <div className="notification-panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Notifications</h4>
      </div>

      {loading && <div>Loading...</div>}
      {!loading && notifications.length === 0 && <div>No notifications</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.map((n) => (
          <div key={n._id} style={{ padding: 12, borderRadius: 10, background: n.read ? '#fafafa' : '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', cursor: 'pointer', transition: 'transform 0.2s ease' }} onClick={() => openNotification(n)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                {n.type === 'application' && (
                  <div>
                    <div style={{ fontWeight: 700 }}>New Application</div>
                    <div style={{ fontWeight: 600, marginTop: 6 }}>{(n.application && n.application.opportunityId && (n.application.opportunityId.title || 'Opportunity')) || (n.meta && n.meta.title) || 'Opportunity'}</div>
                    <div style={{ marginTop: 8, color: '#444' }}>
                      You received a new application from {(n.application && n.application.volunteerId && n.application.volunteerId.fullName) || (n.meta && n.meta.senderName) || 'Someone'}
                    </div>
                  </div>
                )}

                {(n.type === 'accepted' || n.type === 'rejected') && (
                  <div>
                    <div style={{ fontWeight: 700 }}>Application {n.type === 'accepted' ? 'accepted' : 'rejected'}</div>
                    <div style={{ fontWeight: 600, marginTop: 6 }}>{(n.application && n.application.opportunityId && (n.application.opportunityId.title || 'Opportunity')) || (n.meta && n.meta.title) || 'Opportunity'}</div>
                    <div style={{ marginTop: 8, color: '#444' }}>
                      Your {(n.application && n.application.opportunityId && n.application.opportunityId.title) || (n.meta && n.meta.title) || 'application'} application was {n.type === 'accepted' ? 'accepted' : 'rejected'}.
                    </div>
                  </div>
                )}
                {n.type === 'message' && (
                  <div>
                    <div style={{ fontWeight: 700 }}>New Message</div>
                    <div style={{ fontWeight: 600, marginTop: 6, color: '#444' }}>
                      {((n._message && n._message.sender_id && n._message.sender_id.fullName) || (n.meta && n.meta.senderName) || 'Someone')}
                      {' : '}
                      {((n._message && (n._message.content || (n._message.attachments && n._message.attachments.length > 0 && (n._message.attachments[0].type === 'image' ? '📷 Photo' : n._message.attachments[0].type === 'audio' ? '🎵 Audio' : '📄 File')))) || (n.meta && n.meta.message) || '')}
                    </div>
                  </div>
                )}

                
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {(n.type === 'application' || n.type === 'accepted' || n.type === 'rejected' || !n.read) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markRead(n._id); }}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'var(--primary, #08C18A)',
                      color: '#fff',
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
                        <button onClick={(e) => { e.stopPropagation(); handleResponse(n.application._id, n._id, 'accepted'); }} style={{ background: '#08C18A', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: 6 }}>Accept</button>
                        <button onClick={(e) => { e.stopPropagation(); handleResponse(n.application._id, n._id, 'rejected'); }} style={{ background: '#ff3b30', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: 6 }}>Reject</button>
                      </>
                    )}
                    {n.application.status && n.application.status !== 'pending' && (
                      <div style={{ fontSize: 12, color: '#444' }}>{n.application.status}</div>
                    )}
                  </div>
                )}
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
          <VolunteerApplicationModal notif={selectedNotif} onClose={() => setSelectedNotif(null)} onAction={fetchNotifications} />
        )
      )}
      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
    </div>
  );
}

// Append modal component below so edit applies cleanly
export function ApplicationModal({ notif, onClose, onAction }) {
  if (!notif || !notif.application) return null;
  const app = notif.application;
  let opp = app.opportunityId || {};
  
  // Normalize opportunity: extract date from description if present
  if (opp && typeof opp === 'object') {
    const desc = opp.description || "";
    const m = desc.match(/\(Date:\s*([^\)]+)\)\s*$/);
    if (m) {
      const extracted = m[1].trim();
      opp = {
        ...opp,
        description: desc.replace(/\s*\(Date:\s*[^\)]+\)\s*$/, "").trim(),
        date: opp.date || extracted
      };
    }
  }
  
  const vol = app.volunteerId || {};
  const status = (app.status || 'pending').toLowerCase();
  const statusColor = status === 'accepted' ? '#08C18A' : status === 'rejected' ? '#ff3b30' : '#f0ad4e';

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: 640, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>

        {/* Header with Background/Image */}
        <div style={{ height: 180, background: opp.img_link ? `url(${opp.img_link}) center/cover no-repeat` : 'var(--primary, #08C18A)', position: 'relative' }}>
          {!opp.img_link && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 800, opacity: 0.3 }}>WasteZero</div>}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '20px 24px' }}>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 800 }}>{opp.title || 'New Application'}</h2>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* Opportunity Details */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Event Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 15 }}><strong>Date:</strong> {opp.date || 'N/A'}</div>
                <div style={{ fontSize: 15 }}><strong>Location:</strong> {opp.city || (opp.location && (typeof opp.location === 'string' ? opp.location : (opp.location.type === 'Point' && Array.isArray(opp.location.coordinates) ? `Lat: ${opp.location.coordinates[0]}, Lon: ${opp.location.coordinates[1]}` : 'N/A'))) || 'N/A'}</div>
              </div>
            </div>

            {/* Volunteer Details */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>Applicant</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 15 }}><strong>Name:</strong> {vol.fullName}</div>
                <div style={{ fontSize: 15 }}><strong>Email:</strong> {vol.email}</div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 13, color: '#999', textTransform: 'uppercase', marginRight: 12 }}>Status</span>
              <span style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 700,
                background: statusColor + '15',
                color: statusColor,
                textTransform: 'capitalize'
              }}>
                {status}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {status === 'pending' && (
                <>
                  <button
                    onClick={() => onAction(app._id, 'accepted')}
                    style={{ background: '#08C18A', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onAction(app._id, 'rejected')}
                    style={{ background: '#ff3b30', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                style={{ background: '#f5f5f5', color: '#666', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal shown to volunteers — displays opportunity details and application status
export function VolunteerApplicationModal({ notif, onClose, onAction }) {
  if (!notif || !notif.application) return null;
  const app = notif.application;
  let opp = app.opportunityId || {};
  
  // Normalize opportunity: extract date from description if present
  if (opp && typeof opp === 'object') {
    const desc = opp.description || "";
    const m = desc.match(/\(Date:\s*([^\)]+)\)\s*$/);
    if (m) {
      const extracted = m[1].trim();
      opp = {
        ...opp,
        description: desc.replace(/\s*\(Date:\s*[^\)]+\)\s*$/, "").trim(),
        date: opp.date || extracted
      };
    }
  }
  
  const isDeleted = !app.opportunityId || (typeof app.opportunityId === 'object' && !app.opportunityId._id);
  const status = (app.status || 'pending').toLowerCase();
  const statusColor = status === 'accepted' ? '#0bbd66' : status === 'rejected' ? '#e74c3c' : '#f0ad4e';

  const [notification, setNotification] = useState({ open: false, message: "", type: "info", closing: false });

  const showMessage = (msg, type = "info", duration = 3000) => {
    setNotification({ open: true, message: msg, type, closing: false });
    window.setTimeout(() => {
      setNotification((s) => ({ ...s, closing: true }));
      window.setTimeout(() => setNotification({ open: false, message: "", type: "info", closing: false }), 300);
    }, duration);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleDeleteClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`${API_BASE}/applications/${app._id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        showMessage(status === 'pending' ? "Application withdrawn successfully." : "Application record deleted.", "success");
        window.setTimeout(() => {
          onClose();
          if (onAction) onAction();
        }, 1200);
      } else {
        const data = await res.json();
        showMessage(data.message || "Failed to remove application", "error");
      }
    } catch (err) {
      console.error("handleDelete error:", err);
      showMessage("Error removing application", "error");
    } finally {
      setConfirming(false);
      setConfirmOpen(false);
    }
  };

  const confirmMsg = status === 'pending'
    ? "Are you sure you want to withdraw your application ?"
    : "Are you sure you want to delete this application record?";

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: 820, background: '#fff', borderRadius: 12, padding: 24, maxHeight: '90%', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
        {confirming && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
            <div style={{ color: 'var(--primary, #08C18A)', fontWeight: 700, fontSize: 20 }}>Processing request...</div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid #ddd', background: '#f5f5f5' }}>Back</button>
          {!isDeleted && (
            <div style={{ fontWeight: 700, fontSize: 18, color: statusColor, textTransform: 'capitalize', padding: '6px 12px', border: `1px solid ${statusColor}`, borderRadius: 20 }}>
              {status}
            </div>
          )}
        </div>

        {isDeleted ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#fff5f5', borderRadius: 10, border: '1px dashed #feb2b2', marginBottom: 24 }}>
            <h3 style={{ color: '#c53030', margin: 0 }}>This opportunity was deleted by the NGO</h3>
            <p style={{ color: '#742a2a', marginTop: 8 }}>You can delete this application request to clear your history.</p>
          </div>
        ) : (
          <>
            {opp.img_link && (
              <div style={{ width: '100%', height: 260, overflow: 'hidden', borderRadius: 10, marginBottom: 20 }}>
                <img src={opp.img_link} alt={opp.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <h2 style={{ marginTop: 0, fontSize: 24, color: '#1a1a1a' }}>{opp.title}</h2>
            <p style={{ color: '#4a5568', lineHeight: 1.6, fontSize: 16 }}>{opp.description}</p>

            <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap', borderTop: '1px solid #edf2f7', borderBottom: '1px solid #edf2f7', padding: '16px 0' }}>
              {opp.date && (
                <div style={{ fontSize: 15 }}><strong>Date:</strong> <span style={{ color: '#2c7a7b', marginLeft: 4 }}>{opp.date}</span></div>
              )}
              {(opp.city || opp.location) && (
                <div style={{ fontSize: 15 }}><strong>Location:</strong> <span style={{ color: '#2c7a7b', marginLeft: 4 }}>{opp.city || (typeof opp.location === 'string' ? opp.location : (opp.location.type === 'Point' && Array.isArray(opp.location.coordinates) ? `Lat: ${opp.location.coordinates[0]}, Lon: ${opp.location.coordinates[1]}` : 'N/A'))}</span></div>
              )}
              {opp.duration && (
                <div style={{ fontSize: 15 }}><strong>Duration:</strong> <span style={{ color: '#2c7a7b', marginLeft: 4 }}>{opp.duration} Hours</span></div>
              )}
            </div>
          </>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <strong style={{ display: 'block', marginBottom: 12, fontSize: 16 }}>Application Status:</strong>
            <div style={{
              padding: '12px 20px',
              borderRadius: 8,
              display: 'inline-block',
              background: isDeleted ? '#f7fafc' : (status === 'accepted' ? '#eafff3' : status === 'rejected' ? '#fff0f0' : '#fff8ec'),
              color: isDeleted ? '#4a5568' : (status === 'accepted' ? '#0a8a47' : status === 'rejected' ? '#c0392b' : '#b36d00'),
              fontWeight: 700,
              textTransform: 'capitalize',
              fontSize: 16
            }}>
              {isDeleted ? 'Expired / Deleted' : status}
            </div>
          </div>

          {(status !== 'accepted' || isDeleted) && (
            <button
              onClick={handleDeleteClick}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                background: '#ff3b30',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#d32f2f'}
              onMouseOut={(e) => e.currentTarget.style.background = '#ff3b30'}
            >
              {status === 'pending' ? 'Withdraw Application' : 'Delete Application'}
            </button>
          )}
        </div>

        <ConfirmDialog
          open={confirmOpen}
          message={confirmMsg}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmOpen(false)}
          confirmLabel={status === 'pending' ? "Withdraw" : "Delete"}
          cancelLabel="Keep it"
          confirming={confirming}
          danger={true}
        />

      </div>
      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
    </div>
  );
}




