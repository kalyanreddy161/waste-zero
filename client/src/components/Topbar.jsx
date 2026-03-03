import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../Services/LoadingContext";
import { useMe, API_BASE } from "../Services/useMe";
import socket from "../services/socket";
import NotificationPanel from "./NotificationPanel";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import "../styles/Topbar.css";
import MessageBox from "./MessageBox";
import Loading from "./Loading";

// ✅ Import SVG icons
import profile from "../assets/icons/profile.svg";
import settings from "../assets/icons/settings.svg";
import logout from "../assets/icons/logout.svg";
import searchIcon from "../assets/icons/search.svg";
import NotificationBell from "./NotificationBell";

export default function Topbar() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const initial = me?.fullName ? me.fullName.trim().charAt(0).toUpperCase() : "G";
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { setLoading } = useLoading();

  const [notification, setNotification] = useState({ open: false, message: "", type: "info", closing: false });
  const [unread, setUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Search window state
  const [searchInput, setSearchInput] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchTab, setSearchTab] = useState("opportunities"); // "opportunities" or "mine"
  const [searchApplications, setSearchApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const searchResultsRef = useRef(null);

  const showMessage = (msg, type = "info", duration = 3000) => {
    setNotification({ open: true, message: msg, type, closing: false });
    window.setTimeout(() => {
      setNotification((s) => ({ ...s, closing: true }));
      window.setTimeout(() => setNotification({ open: false, message: "", type: "info", closing: false }), 300);
    }, duration);
  };

  // Check sessionStorage for any global message set before navigation (e.g., login/register/logout)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('global_message');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.message) {
          showMessage(parsed.message, parsed.type || 'info');
        }
        sessionStorage.removeItem('global_message');
      }
    } catch (e) { }
  }, []);

  // Connect socket once the user session is confirmed (works for both NGO and volunteer)
  useEffect(() => {
    if (!me) return; // wait until we know who the user is
    if (!socket.connected) {
      socket.connect();
    }
    // fetch unread count after connection is established
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications/unread-count`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setUnread(data.unread || 0);
      } catch (e) { }
    };
    fetchUnread();
  }, [me]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);

    // socket listeners for incoming notifications
    const processedIds = new Set();
    const onNew = (payload) => {
      // deduplicate by notification ID to prevent double increments
      if (payload && payload.id) {
        if (processedIds.has(payload.id)) return;
        processedIds.add(payload.id);
        // keep set size reasonable
        if (processedIds.size > 50) {
          const first = processedIds.values().next().value;
          processedIds.delete(first);
        }
      }
      setUnread((u) => u + 1);
      // trigger bell animation via global event
      window.dispatchEvent(new CustomEvent('notify:incoming', { detail: payload }));
    };
    socket.on('notification', onNew);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      socket.off('notification', onNew);
    };
  }, []);

  // Global socket listeners for opportunity create/update/delete
  useEffect(() => {
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

    const onCreated = (payload) => {
      try {
        const opp = normalizeOpportunity(payload && payload.opportunity ? payload.opportunity : payload);
        queryClient.setQueryData(["opportunities"], (old) => {
          const arr = Array.isArray(old) ? old.slice() : [];
          const exists = arr.findIndex((x) => String(x._id || x.id) === String(opp._id || opp.id));
          if (exists !== -1) {
            arr[exists] = opp;
          } else {
            arr.unshift(opp);
          }
          return arr;
        });
      } catch (e) { console.error(e); }
    };

    const onUpdated = (payload) => {
      try {
        const opp = normalizeOpportunity(payload && payload.opportunity ? payload.opportunity : payload);
        queryClient.setQueryData(["opportunities"], (old) => {
          const arr = Array.isArray(old) ? old.slice() : [];
          const idx = arr.findIndex((x) => String(x._id || x.id) === String(opp._id || opp.id));
          if (idx !== -1) arr[idx] = opp;
          else arr.unshift(opp);
          return arr;
        });
      } catch (e) { console.error(e); }
    };

    const onDeleted = (payload) => {
      try {
        const id = payload && (payload.id || payload._id || payload) ? String(payload.id || payload._id || payload) : null;
        if (!id) return;
        queryClient.setQueryData(["opportunities"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((x) => String(x._id || x.id) !== id);
        });
      } catch (e) { console.error(e); }
    };

    const attachHandlers = () => {
      try {
        socket.off('opportunity:created', onCreated);
        socket.off('opportunity:updated', onUpdated);
        socket.off('opportunity:deleted', onDeleted);
      } catch (e) {}
      socket.on('opportunity:created', onCreated);
      socket.on('opportunity:updated', onUpdated);
      socket.on('opportunity:deleted', onDeleted);
    };

    attachHandlers();

    const onConnect = () => attachHandlers();
    const onDisconnect = () => {};
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      try {
        socket.off('opportunity:created', onCreated);
        socket.off('opportunity:updated', onUpdated);
        socket.off('opportunity:deleted', onDeleted);
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
      } catch (e) {}
    };
  }, [queryClient]);

  // Fetch search applications when searching
  useEffect(() => {
    if (!me || me.role !== "volunteer" || searchInput.trim() === "") {
      setSearchApplications([]);
      return;
    }
    
    const fetchApplications = async () => {
      setApplicationsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/applications/my`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const applications = Array.isArray(data) ? data : [];
        
        // Filter applications that match the search input
        const searchLower = searchInput.toLowerCase();
        const filtered = applications.filter((app) => {
          const opp = app.opportunityId;
          if (!opp) return false;
          const title = opp.title || "";
          const desc = opp.description || "";
          return title.toLowerCase().includes(searchLower) || desc.toLowerCase().includes(searchLower);
        });
        setSearchApplications(filtered);
      } catch (e) {
        setSearchApplications([]);
      } finally {
        setApplicationsLoading(false);
      }
    };

    fetchApplications();
  }, [searchInput, me]);

  // Listen to topbar search input changes
  useEffect(() => {
    const topInput = document.querySelector('.topbar-search');
    if (!topInput) return;

    const onInput = (e) => {
      const value = e.target?.value || "";
      setSearchInput(value);
      setShowSearchResults(value.trim().length > 0);
    };

    const onFocus = () => {
      if (searchInput.trim().length > 0) {
        setShowSearchResults(true);
      }
    };

    topInput.addEventListener('input', onInput);
    topInput.addEventListener('focus', onFocus);

    return () => {
      topInput.removeEventListener('input', onInput);
      topInput.removeEventListener('focus', onFocus);
    };
  }, [searchInput]);

  // Close search results on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(e.target)) {
        const topInput = document.querySelector('.topbar-search');
        if (!topInput || !topInput.contains(e.target)) {
          setShowSearchResults(false);
        }
      }
    };

    if (showSearchResults) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showSearchResults]);

  // Clear search input when navigating away
  useEffect(() => {
    return () => {
      const topInput = document.querySelector('.topbar-search');
      if (topInput) {
        topInput.value = '';
      }
      setSearchInput("");
      setShowSearchResults(false);
    };
  }, []);

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

  // Fetch opportunities with proper normalization
  const { data: cachedOpportunities } = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/opportunities`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load opportunities');
      const data = await res.json();
      return Array.isArray(data) ? data.map(normalizeOpportunity) : [];
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const filteredSearchResults = useMemo(() => {
    if (!cachedOpportunities || searchInput.trim() === "") {
      return [];
    }

    const searchLower = searchInput.toLowerCase();
    let results = cachedOpportunities.map(normalizeOpportunity).filter((opp) => {
      const title = opp.title || "";
      const desc = opp.description || "";
      return title.toLowerCase().includes(searchLower) || desc.toLowerCase().includes(searchLower);
    });

    // Filter based on tab
    if (searchTab === "mine" && me?.role === "ngo") {
      const myId = me?.id || me?._id;
      results = results.filter((o) => {
        const owner = o.ngo_id || o.NGO_ID;
        const ownerId = (owner && owner._id) || owner;
        return ownerId && String(ownerId) === String(myId);
      });
    }

    return results;
  }, [cachedOpportunities, searchInput, searchTab, me]);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-search-wrapper">
          <img src={searchIcon} alt="Search" className="search-icon" />
          <input 
            className="topbar-search" 
            placeholder="Search pickups, opportunities..." 
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              setSearchInput(value);
              setShowSearchResults(value.trim().length > 0);
              // Dispatch input event for Opportunities component to listen
              e.target.dispatchEvent(new Event('input', { bubbles: true }));
            }}
            onFocus={() => {
              if (searchInput.trim().length > 0) {
                setShowSearchResults(true);
              }
            }}
          />
        </div>

        {/* Search Results Window */}
        {showSearchResults && (
          <div 
            ref={searchResultsRef}
            className="topbar-search-results"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Toggle Switch */}
            {me && (
              <label className="search-results-switch" aria-label="Toggle Search Filter">
                <input
                  type="checkbox"
                  checked={searchTab === "mine"}
                  onChange={(e) => setSearchTab(e.target.checked ? "mine" : "opportunities")}
                />
                <span>Opportunities</span>
                <span>{me.role === "volunteer" ? "My Applications" : "My Opportunities"}</span>
              </label>
            )}

            {/* Results */}
            <div className="search-results-container">
              {searchTab === "opportunities" ? (
                filteredSearchResults.length === 0 ? (
                  <div className="search-no-results">No opportunities found</div>
                ) : (
                  <div className="search-results-list">
                    {filteredSearchResults.map((opp) => (
                      <div
                        key={opp._id || opp.id}
                        className="search-result-item"
                        onClick={() => {
                          const topInput = document.querySelector('.topbar-search');
                          if (topInput) {
                            topInput.value = '';
                          }
                          setSearchInput("");
                          setShowSearchResults(false);
                          navigate(`/home/opportunities`, { state: { openId: opp._id || opp.id } });
                        }}
                      >
                        <div className="search-result-title">{opp.title}</div>
                        <div className="search-result-meta">
                          {opp.date && <span className="search-result-date">{opp.date}</span>}
                          {opp.city && <span className="search-result-city">{opp.city}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : me?.role === "volunteer" ? (
                applicationsLoading ? (
                  <div className="search-no-results">Loading...</div>
                ) : searchApplications.length === 0 ? (
                  <div className="search-no-results">No applications found</div>
                ) : (
                  <div className="search-results-list">
                    {searchApplications.map((app) => {
                      const opp = app.opportunityId || {};
                      return (
                        <div
                          key={app._id || app.id}
                          className="search-result-item"
                          onClick={() => {
                            const topInput = document.querySelector('.topbar-search');
                            if (topInput) {
                              topInput.value = '';
                            }
                            setSearchInput("");
                            setShowSearchResults(false);
                            navigate(`/home/opportunities`, { state: { openId: opp._id || opp.id } });
                          }}
                        >
                          <div className="search-result-title">{opp.title}</div>
                          <div className="search-result-meta">
                            {opp.date && <span className="search-result-date">{opp.date}</span>}
                            <span className={`search-result-status search-result-status-${(app.status || 'pending').toLowerCase()}`}>
                              {(app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                filteredSearchResults.length === 0 ? (
                  <div className="search-no-results">No opportunities found</div>
                ) : (
                  <div className="search-results-list">
                    {filteredSearchResults.map((opp) => (
                      <div
                        key={opp._id || opp.id}
                        className="search-result-item"
                        onClick={() => {
                          const topInput = document.querySelector('.topbar-search');
                          if (topInput) {
                            topInput.value = '';
                          }
                          setSearchInput("");
                          setShowSearchResults(false);
                          navigate(`/home/opportunities`, { state: { openId: opp._id || opp.id } });
                        }}
                      >
                        <div className="search-result-title">{opp.title}</div>
                        <div className="search-result-meta">
                          {opp.date && <span className="search-result-date">{opp.date}</span>}
                          {opp.city && <span className="search-result-city">{opp.city}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <div className="topbar-right" ref={menuRef}>
        <div className="icon-btn" aria-label="notifications" style={{ position: 'relative' }}>
          <div onClick={() => { setShowNotifications((s) => !s); if (!showNotifications) setUnread(0); }} style={{ cursor: 'pointer' }}>
            <NotificationBell />
            {unread > 0 && (
              <div style={{ position: 'absolute', right: 0, top: -4, background: '#ff3b30', color: '#fff', borderRadius: '10px', padding: '2px 6px', fontSize: 12 }}>
                {unread}
              </div>
            )}
          </div>

          {showNotifications && (
            <div style={{ position: 'absolute', right: 0, top: 44, width: 360, maxHeight: 420, overflow: 'auto', background: '#fff', boxShadow: '0 6px 24px rgba(0,0,0,0.12)', borderRadius: 8, zIndex: 60 }}>
              <NotificationPanel />
            </div>
          )}
        </div>
        <div className="user-circle" title={me?.fullName || "Guest"} onClick={() => setOpen(!open)}>{initial}</div>

        {open && (
          <div className="topbar-menu">
            <div className="menu-content">
              <div className="menu-name">{me?.fullName || "Guest"}</div>
              <button className="menu-item" onClick={() => { setOpen(false); navigate('/home/profile'); }}><img src={profile} alt="Profile" className="menu-icon" /> Profile</button>
              <button className="menu-item" onClick={() => { setOpen(false); navigate('/home/settings'); }}><img src={settings} alt="Settings" className="menu-icon" /> Settings</button>
              <button
                className="menu-item menu-logout"
                onClick={async () => {
                  setOpen(false);
                  try {
                    // show global loader during logout
                    setLoading(true);
                    await fetch(`${API_BASE}/auth/logout`, {
                      method: "POST",
                      credentials: "include"
                    });
                    // Disconnect socket so it doesn't reconnect with stale session
                    socket.disconnect();
                    // Clear all cached data on logout
                    queryClient.clear();
                    // set a global message to show on the landing page
                    try { sessionStorage.setItem('global_message', JSON.stringify({ message: 'Logout successful', type: 'success' })); } catch (e) { }
                  } catch (err) {
                    // ignore network errors
                  } finally {
                    setLoading(false);
                  }
                  navigate('/');
                }}
              >
                <img src={logout} alt="Logout" className="menu-icon" /> Logout
              </button>
            </div>
          </div>
        )}
      </div>
      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
      <Loading isLoading={false} />
    </div>
  );
}
