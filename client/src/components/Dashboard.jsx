import React, { useEffect, useState, useRef } from "react";
import "../styles/NavbarComponents-styles/Dashboard.css";
import Opportunities from "./Opportunities";
import { API_BASE, useMe } from "../Services/useMe";
import { useQuery } from "@tanstack/react-query";
import { useApplications } from "../Services/useApplications";
import { useNavigate } from "react-router-dom";
import { VolunteerApplicationModal } from "./NotificationPanel";
import socket from "../services/socket";
import completeIcon from "../assets/icons/complete.svg";
import pickupIcon from "../assets/icons/pickup.svg";
import co2Icon from "../assets/icons/co2saved.svg";

const Dashboard = () => {
  const [previewOpps, setPreviewOpps] = useState([]);
  const carouselRef = useRef(null);
  const autoRef = useRef(null);
  const navigating = useNavigate();
  const { data: me } = useMe();

  // Stats state for dashboard cards
  const [activeOpportunitiesCount, setActiveOpportunitiesCount] = useState(0);
  const [opportunitiesJoinedCount, setOpportunitiesJoinedCount] = useState(0);
  const [pickupsCompleted] = useState(0); // placeholder for now
  const [co2Saved] = useState(0); // placeholder for now

  // Use react-query hook to fetch and cache applications
  const { data: applications = [], isLoading: appsLoading, error: appsError, refetch: refetchApplications } = useApplications();
  const [showAppModal, setShowAppModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  const { data: cachedOpportunities } = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/opportunities`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load opportunities');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!cachedOpportunities || !Array.isArray(cachedOpportunities)) {
      setPreviewOpps([]);
      return;
    }
    setPreviewOpps(cachedOpportunities.slice(0, 8));
  }, [cachedOpportunities]);

  // Calculate active opportunities count (status: "open" or "in-progress")
  const calculateActiveOpportunitiesCount = (opportunities) => {
    if (!Array.isArray(opportunities)) return 0;
    return opportunities.filter((opp) => opp.status === "open" || opp.status === "in-progress").length;
  };

  // Calculate opportunities joined count
  const calculateOpportunitiesJoinedCount = () => {
    if (!Array.isArray(applications)) return 0;
    // For volunteers: count applications with status "accepted"
    if (me?.role === "volunteer") {
      return applications.filter((app) => app.status === "accepted").length;
    }
    // For NGOs: count opportunities created by this NGO
    if (me?.role === "ngo") {
      if (!Array.isArray(cachedOpportunities)) return 0;
      const myId = me._id || me.id;
      return cachedOpportunities.filter((opp) => {
        const ownerId = opp.ngo_id?._id || opp.ngo_id;
        return String(ownerId) === String(myId);
      }).length;
    }
    return 0;
  };

  // Update stats when opportunities or applications change
  useEffect(() => {
    if (cachedOpportunities) {
      setActiveOpportunitiesCount(calculateActiveOpportunitiesCount(cachedOpportunities));
    }
  }, [cachedOpportunities]);

  useEffect(() => {
    setOpportunitiesJoinedCount(calculateOpportunitiesJoinedCount());
  }, [applications, cachedOpportunities, me]);

  // Socket listener for real-time opportunity stats updates
  useEffect(() => {
    if (!socket.connected) return;

    const handleOpportunitiesUpdate = () => {
      if (cachedOpportunities) {
        setActiveOpportunitiesCount(calculateActiveOpportunitiesCount(cachedOpportunities));
      }
    };

    const handleApplicationStatusChange = (payload) => {
      // If user is a volunteer and the status change is for their application, update count by recalculating
      if (me?.role === "volunteer") {
        // Refetch the applications to get the latest data
        refetchApplications().catch(() => {});
      } else if (me?.role === "ngo") {
        // For NGOs, trigger recalculation if needed
        setOpportunitiesJoinedCount(calculateOpportunitiesJoinedCount());
      }
    };

    socket.on("opportunity:created", handleOpportunitiesUpdate);
    socket.on("opportunity:updated", handleOpportunitiesUpdate);
    socket.on("opportunity:deleted", handleOpportunitiesUpdate);
    socket.on("application:status-changed", handleApplicationStatusChange);

    return () => {
      socket.off("opportunity:created", handleOpportunitiesUpdate);
      socket.off("opportunity:updated", handleOpportunitiesUpdate);
      socket.off("opportunity:deleted", handleOpportunitiesUpdate);
      socket.off("application:status-changed", handleApplicationStatusChange);
    };
  }, [cachedOpportunities, me, refetchApplications]);

  // carousel scroll helpers
  const indexRef = useRef(0);

  const scrollToIndex = (idx, smooth = true) => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector('.opp-carousel-card');
    const gap = 20;
    const cardW = card ? card.offsetWidth + gap : el.clientWidth;
    el.scrollTo({ left: idx * cardW, behavior: smooth ? 'smooth' : 'auto' });
  };

  const next = () => {
    const len = previewOpps.length;
    if (len === 0) return;
    indexRef.current += 1;
    scrollToIndex(indexRef.current, true);
    // if we moved to cloned first (index === len), jump back to 0 after animation
    if (indexRef.current === len) {
      // allow smooth scroll to finish then jump
      setTimeout(() => {
        indexRef.current = 0;
        scrollToIndex(0, false);
      }, 100);
    }
  };



  const [activeTab, setActiveTab] = useState("opportunities"); // "opportunities" or "mine"

  // Refetch applications when user toggles to "My Applications" tab
  useEffect(() => {
    if (activeTab === "mine" && me?.role === "volunteer") {
      refetchApplications().catch(() => { });
    }
  }, [activeTab, me?.role, refetchApplications]);

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

  return (
    <div className="page dashboard-page">
      <div style={{ marginBottom: 24 }}>
        <h2>Dashboard</h2>
        <p style={{ color: "#777" }}>
          Welcome back, {me?.fullName || "User"}! Here's your waste management overview.
        </p>
      </div>

      {/* Stats Cards Section */}
      <div className="dashboard-stats-container" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-icon">
            <lord-icon
              src="https://cdn.lordicon.com/mhridhuu.json"
              trigger="loop"
              stroke="bold"
              state="loop-wave"
              style={{ width: '50px', height: '50px' }}>
            </lord-icon>
          </div>
          <div className="stat-content">
            <div className="stat-number">{activeOpportunitiesCount}</div>
            <div className="stat-label">Active Opportunities</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <img src={completeIcon} alt="Completed" style={{ width: '50px', height: '50px' }} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{opportunitiesJoinedCount}</div>
            <div className="stat-label">
              {me?.role === "volunteer" ? "Opportunities Joined" : "Your Opportunities"}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <img src={pickupIcon} alt="Pickups" style={{ width: '50px', height: '50px' }} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{pickupsCompleted}</div>
            <div className="stat-label">Pickups Completed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <img src={co2Icon} alt="CO2 Saved" style={{ width: '50px', height: '50px' }} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{co2Saved}</div>
            <div className="stat-label">CO2 Saved (kg)</div>
          </div>
        </div>
      </div>

      {/* Toggle switch */}
      {me && (
        <label htmlFor="filter-toggle" className="switch" aria-label="Toggle Filter">
          <input
            type="checkbox"
            id="filter-toggle"
            checked={activeTab === "mine"}
            onChange={(e) => setActiveTab(e.target.checked ? "mine" : "opportunities")}
          />
          <span>Opportunities</span>
          <span>{me.role === "volunteer" ? "My Applications" : "My Opportunities"}</span>
        </label>
      )}

      {/* Conditional Content */}
      <div className="dashboard-content" style={{ overflow: 'visible' }}>
        {activeTab === "opportunities" ? (
          <Opportunities fromDashboard={true} hideFilter={true} hideHeader={true} key="all" />
        ) : me?.role === "volunteer" ? (
          <div style={{ marginTop: 12 }}>
            {appsLoading ? (
              <p>Loading applications...</p>
            ) : appsError ? (
              <p style={{ color: 'red' }}>{appsError instanceof Error ? appsError.message : String(appsError)}</p>
            ) : applications.length === 0 ? (
              <p style={{ color: '#666' }}>You haven't applied to any opportunities yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 12 }}>
                {applications.map((app) => {
                  const opp = normalizeOpportunity(app && app.opportunityId ? app.opportunityId : {});
                  const key = app._id || app.id || (opp._id || opp.id) || Math.random();
                  const status = (app.status || 'pending').toLowerCase();
                  const statusColor = status === 'accepted' ? '#0bbd66' : status === 'rejected' ? '#e74c3c' : '#f0ad4e';
                  return (
                    <div
                      key={key}
                      className="opp-carousel-card"
                      style={{ width: '100%', cursor: 'pointer' }}
                      onClick={() => { setSelectedApp(app); setShowAppModal(true); }}
                    >
                      {opp && opp.img_link ? (
                        <div className="opp-card-img-wrap-small"><img src={opp.img_link} alt={opp.title} loading="lazy" /></div>
                      ) : (
                        <div className="opp-card-img-placeholder-small">No image</div>
                      )}
                      <div className="opp-card-body-small">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <h4 className="opp-card-title-small" style={{ flex: 1, minWidth: 0, margin: 0, fontSize: '1.1rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {opp && opp.title}
                          </h4>
                          <div style={{
                            background: '#fff',
                            borderRadius: 14,
                            padding: '4px 10px',
                            border: `1px solid ${statusColor}`,
                            color: statusColor,
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {status}
                          </div>
                        </div>
                        {/* Modified part: only date, no description */}
                        <p className="opp-card-text-small" style={{ marginTop: 12, fontWeight: '600', color: '#555', fontSize: '0.9rem' }}>
                          Date: {opp.date || "N/A"}
                        </p>
                        <div style={{ marginTop: 16 }}>
                          <button
                            className="primary opp-card-apply"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', fontWeight: '600' }}
                            onClick={(e) => { e.stopPropagation(); setSelectedApp(app); setShowAppModal(true); }}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <Opportunities fromDashboard={true} hideFilter={true} hideHeader={true} initialScopeFilter="mine" key="mine" />
          </div>
        )}
      </div>

      {/* Application details modal */}
      {showAppModal && selectedApp && (
        <VolunteerApplicationModal
          notif={{
            application: {
              ...selectedApp,
              opportunityId: (selectedApp.opportunityId && typeof selectedApp.opportunityId === 'object') ? selectedApp.opportunityId : (selectedApp.opportunityId || {})
            }
          }}
          onClose={() => { setShowAppModal(false); setSelectedApp(null); }}
          onAction={refetchApplications}
        />
      )}

      <br /><br />
    </div>
  );
};

export default Dashboard;
