import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/NavbarComponents-styles/Opportunities.css";
import { useMe, API_BASE } from "../Services/useMe";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApplications, invalidateApplicationsCache, updateApplicationInCache } from "../Services/useApplications";
import ConfirmDialog from "./ConfirmDialog";
import MessageBox from "./MessageBox";
import Loading from "./Loading";
import MapPicker from "./MapPicker";
import socket from "../Services/socket";
import { VolunteerApplicationModal, ApplicationModal } from "./NotificationPanel";

const formatRelativeTime = (iso) => {
  if (!iso) return "";
  const created = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
};

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
);

const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
);

const Opportunities = ({ fromDashboard, hideFilter, hideHeader, initialScopeFilter, initialStatusFilter } = {}) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "all");

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [duration, setDuration] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("open");
  const [imgLink, setImgLink] = useState("");
  const [date, setDate] = useState("");
  const [locationCoords, setLocationCoords] = useState(null); // { lat, lon }
  const [mapOpen, setMapOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [selected, setSelected] = useState(null);
  const [imageOverlay, setImageOverlay] = useState(null);
  const [selectedBeforeSearch, setSelectedBeforeSearch] = useState(null);
  const [closedManually, setClosedManually] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [participantsCountMap, setParticipantsCountMap] = useState({});
  const [notification, setNotification] = useState({ open: false, message: "", type: "info", closing: false });
  const [showAppView, setShowAppView] = useState(false);

  // NGO: View Applications for the selected opportunity
  const [showApplicantsView, setShowApplicantsView] = useState(false);
  const [opportunityApplicants, setOpportunityApplicants] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [selectedApplicantNotif, setSelectedApplicantNotif] = useState(null);

  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { data: applications = [], refetch: refetchApplications } = useApplications();
  console.log("Opportunities - me object:", me);
  const navigate = useNavigate();
  const loc = useLocation();
  const [topbarPresent, setTopbarPresent] = useState(true);
  const isFromDashboard = Boolean(fromDashboard || (loc && loc.state && loc.state.fromDashboard));
  const [scopeFilter, setScopeFilter] = useState(initialScopeFilter || 'all'); // 'all' | 'mine'
  const [compositeOpen, setCompositeOpen] = useState(false);
  const compositeRef = useRef(null);

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

  const fetchParticipantsCount = async (oppId) => {
    if (!oppId) return 0;
    try {
      const res = await fetch(`${API_BASE}/opportunities/${oppId}/participants-count`, { credentials: 'include' });
      if (!res.ok) return 0;
      const data = await res.json();
      setParticipantsCountMap((s) => ({ ...(s || {}), [oppId]: data.count || 0 }));
      return data.count || 0;
    } catch (err) {
      return 0;
    }
  };

  // Notification helper: shows a MessageBox and auto-dismisses it
  const showMessage = (msg, type = "info", duration = 3000) => {
    setNotification({ open: true, message: msg, type, closing: false });
    // start closing after duration
    window.setTimeout(() => {
      setNotification((s) => ({ ...s, closing: true }));
      window.setTimeout(() => setNotification({ open: false, message: "", type: "info", closing: false }), 300);
    }, duration);
  };

  // Use react-query to fetch opportunities and keep a long-lived cache.
  const {
    data: fetchedOpportunities,
    isLoading: fetchedLoading,
    error: fetchedError,
  } = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/opportunities`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load opportunities");
      const data = await res.json();
      return Array.isArray(data) ? data.map(normalizeOpportunity) : [];
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // When opportunities are refetched, also refetch applications to keep embedded opportunity data fresh
  useEffect(() => {
    if (fetchedOpportunities) {
      refetchApplications().catch(() => { });
    }
  }, [fetchedOpportunities, refetchApplications]);

  // Helper: haversine distance in meters
  const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371e3; // metres
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Compute and cache sorted opportunities using user location. We only recompute
  // when the raw list changes or the user's location changes. React Query holds
  // the raw data so we avoid network refetching; server emits will update the cache.
  useEffect(() => {
    const raw = Array.isArray(fetchedOpportunities) ? fetchedOpportunities.slice() : [];
    if (!raw || raw.length === 0) {
      setOpportunities([]);
      return;
    }

    const userLat = me && me.location && me.location.coordinates && me.location.coordinates.length === 2 ? me.location.coordinates[1] : null;
    const userLon = me && me.location && me.location.coordinates && me.location.coordinates.length === 2 ? me.location.coordinates[0] : null;

    if (userLat == null || userLon == null) {
      // user location not available - keep server ordering
      setOpportunities(raw);
      return;
    }

    // compute distance for each opportunity that has coordinates
    const withDist = raw.map((o) => {
      if (o && o.location && o.location.type === 'Point' && Array.isArray(o.location.coordinates) && o.location.coordinates.length >= 2) {
        const [lat, lon] = o.location.coordinates;
        try {
          const d = haversine(userLat, userLon, Number(lat), Number(lon));
          return { ...o, __distance: d };
        } catch (e) { return { ...o, __distance: Infinity }; }
      }
      return { ...o, __distance: Infinity };
    });

    withDist.sort((a, b) => (a.__distance || Infinity) - (b.__distance || Infinity));
    setOpportunities(withDist);
  }, [fetchedOpportunities, me]);

  // When on the opportunities page, hide the outer/main scrollbar and
  // allow the opportunities container to handle scrolling to avoid
  // double scrollbars. Clean up on unmount.
  useEffect(() => {
    if (fromDashboard) return;
    const main = document.querySelector("main");
    if (main) main.classList.add("opp-hide-main-scroll");
    return () => {
      if (main) main.classList.remove("opp-hide-main-scroll");
    };
  }, [fromDashboard]);

  const filtered = useMemo(() => {
    // base set depending on scope
    let base = Array.isArray(opportunities) ? opportunities.map(normalizeOpportunity) : [];
    if (scopeFilter === 'mine') {
      const myId = me?.id || me?._id;
      if (myId) {
        if (me.role === 'ngo') {
          base = base.filter((o) => {
            const owner = o.ngo_id || o.NGO_ID;
            const ownerId = (owner && owner._id) || owner;
            return ownerId && String(ownerId) === String(myId);
          });
        } else if (me.role === 'volunteer') {
          // Use the `applications` state for filtering as it is synced in real-time
          const appliedIds = Array.isArray(applications)
            ? applications.map(app => String(app.opportunityId?._id || app.opportunityId))
            : [];
          base = base.filter((o) => {
            const oppId = String(o._id || o.id);
            return appliedIds.includes(oppId);
          });
        }
      } else {
        base = [];
      }
    }

    return base.filter((opp) => {
      const matchSearch =
        !search ||
        (opp.title && opp.title.toLowerCase().includes(search.toLowerCase())) ||
        (opp.description && opp.description.toLowerCase().includes(search.toLowerCase()));

      const matchStatus =
        statusFilter === "all" ||
        !opp.status ||
        opp.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [opportunities, search, statusFilter, scopeFilter, me]);

  const userApp = useMemo(() => {
    if (!selected || !applications) return null;
    const sId = String(selected._id || selected.id);
    return applications.find((a) => {
      const oppId = a.opportunityId?._id || a.opportunityId;
      return String(oppId) === sId;
    });
  }, [selected, applications]);

  const isParticipant = useMemo(() => {
    if (!selected || !me || !applications) return false;
    const uid = String(me?._id || me?.id);
    // check user's own applications for this opportunity with accepted status
    const sId = String(selected._id || selected.id);
    return applications.some((a) => {
      const oppId = a.opportunityId?._id || a.opportunityId;
      return String(oppId) === sId && a.status === 'accepted';
    });
  }, [selected, me, applications]);

  // Debug: log filter state and result count when filters change
  useEffect(() => {
    try {
      console.log('Opportunities filters:', { scopeFilter, statusFilter, search, me });
      console.log('Filtered count:', filtered.length);
    } catch (e) { }
  }, [scopeFilter, statusFilter, search, filtered, me]);

  // Ensure composite menu closes when filters change (covers any event propagation issues)
  useEffect(() => {
    if (compositeOpen) setCompositeOpen(false);
  }, [scopeFilter, statusFilter]);

  const handleOpenCreate = () => {
    setTitle("");
    setDescription("");
    setRequiredSkills("");
    setDuration("");
    setCity("");
    setStatus("open");
    setImgLink("");
    setDate("");
    setError("");
    setEditingId(null);
    setLocationCoords(null);
    setShowCreate(true);
  };

  const handleOpenEdit = (opp) => {
    setEditingId(opp._id || opp.id || null);
    setTitle(opp.title || "");
    setDescription(opp.description || "");
    setRequiredSkills(Array.isArray(opp.required_skills) ? opp.required_skills.join(", ") : (opp.required_skills || ""));
    setDuration(opp.duration || "");
    setCity(opp.city || "");
    setStatus(opp.status || "open");
    setImgLink(opp.img_link || "");
    setDate(opp.date || "");
    setError("");
    if (opp.location && opp.location.type === 'Point' && Array.isArray(opp.location.coordinates) && opp.location.coordinates.length >= 2) {
      const [lat, lon] = opp.location.coordinates;
      setLocationCoords({ lat, lon });
    } else {
      setLocationCoords(null);
    }
    setShowCreate(true);
  };

  const handleDeleteClick = (opp) => {
    if (!opp) return;
    setConfirmId(opp._id || opp.id);
    setConfirmMessage(`Are you sure to delete ${opp.title || 'this opportunity'} ? This action cannot be revert.`);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/opportunities/${confirmId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete opportunity");

      setOpportunities((prev) => prev.filter((p) => p._id !== confirmId));
      try {
        queryClient.setQueryData(["opportunities"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.filter((x) => String(x._id || x.id) !== String(confirmId));
        });
      } catch (e) { console.error('failed to update query cache after delete', e); }
      if (selected && selected._id === confirmId) setSelected(null);
      setConfirmOpen(false);
      setConfirmId(null);
      showMessage("Opportunity deleted", "success");
    } catch (err) {
      const msg = err.message || "Error deleting opportunity";
      setError(msg);
      showMessage(msg, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const ngoId = me?.id || me?._id;
    if (!ngoId) {
      setError("NGO id is not set. Please log in as NGO.");
      return;
    }
    if (isUploading) {
      setError("Please wait for image to finish uploading.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const body = {
        ngo_id: ngoId,
        title,
        description,
        required_skills: requiredSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        duration: (duration === "" ? undefined : Number(duration)),
        city: city || undefined,
        status,
        img_link: imgLink || undefined,
      };
      if (locationCoords && locationCoords.lat != null && locationCoords.lon != null) {
        body.location = { type: 'Point', coordinates: [locationCoords.lat, locationCoords.lon] };
      }
      // optional date: we store as part of description for now; schema doesn't have date field
      if (date) {
        body.description = `${description} (Date: ${date})`;
      }
      const res = await fetch(`${API_BASE}/opportunities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create opportunity");
      }
      let created = data.opportunity || data;
      // normalize created opportunity for date/description
      if (created) {
        const desc = created.description || "";
        const m = desc.match(/\(Date:\s*([^\)]+)\)\s*$/);
        if (m) {
          const extracted = m[1].trim();
          created.description = desc.replace(/\s*\(Date:\s*[^\)]+\)\s*$/, "").trim();
          created.date = created.date || extracted;
        }
      }
      try {
        queryClient.setQueryData(["opportunities"], (old) => {
          const arr = Array.isArray(old) ? old.slice() : [];
          const exists = arr.findIndex((x) => String(x._id || x.id) === String(created._id || created.id));
          if (exists !== -1) arr[exists] = created; else arr.unshift(created);
          return arr;
        });
      } catch (e) { console.error('failed to update query cache after create', e); }
      setShowCreate(false);
      showMessage("Opportunity created", "success");
      // If this component was rendered inside the Dashboard (or navigated
      // here from the dashboard), navigate to the full Opportunities page
      // so the created item and details are visible.
      if (isFromDashboard) {
        try {
          navigate('/home/opportunities', { state: { openId: created._id || created.id } });
        } catch (e) { }
      }
    } catch (err) {
      const msg = err.message || "Error creating opportunity";
      setError(msg);
      showMessage(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingId) return setError("No opportunity selected to update.");
    if (isUploading) return setError("Please wait for image to finish uploading.");
    setCreating(true);
    setError("");
    try {
      const body = {
        title,
        description,
        required_skills: requiredSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        duration: (duration === "" ? undefined : Number(duration)),
        city: city || undefined,
        status,
        img_link: imgLink || undefined,
      };
      if (locationCoords && locationCoords.lat != null && locationCoords.lon != null) {
        body.location = { type: 'Point', coordinates: [locationCoords.lat, locationCoords.lon] };
      }
      if (date) {
        body.description = `${description} (Date: ${date})`;
      }

      const res = await fetch(`${API_BASE}/opportunities/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update opportunity");

      const updated = data.opportunity || data;
      const norm = normalizeOpportunity(updated);

      setOpportunities((prev) => prev.map((p) => (p._id === norm._id ? norm : p)));
      try {
        queryClient.setQueryData(["opportunities"], (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((x) => (String(x._id || x.id) === String(norm._id || norm.id) ? norm : x));
        });
      } catch (e) { console.error('failed to update query cache after update', e); }
      // if this opportunity is currently open in details, update selected
      if (selected && (selected._id === norm._id)) {
        setSelected(norm);
      }

      setShowCreate(false);
      setEditingId(null);
      showMessage("Opportunity updated", "success");
    } catch (err) {
      const msg = err.message || "Error updating opportunity";
      setError(msg);
      showMessage(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleApply = async () => {
    if (!selected || !me) return;
    const oppId = selected._id || selected.id;
    if (!oppId) return;

    setIsApplying(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/applications/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: oppId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to apply");

      // optimistic update: mark selected as pending and update applications list
      setSelected((s) => ({ ...(s || {}), status: "pending" }));
      setOpportunities((prev) => prev.map((o) => (String(o._id) === String(oppId) ? { ...o, status: "pending" } : o)));
      
      // Update cache and refetch to get fresh data with populated opportunity fields
      invalidateApplicationsCache(queryClient);
      await refetchApplications();

      // notify user in UI
      showMessage("Application submitted!", "success");
    } catch (err) {
      const msg = err.message || "Error applying to opportunity";
      if (msg === "Already applied") {
        // Already applied — nothing to change for participants count until accepted.
        // Refresh user's applications to sync UI.
        invalidateApplicationsCache(queryClient);
        await refetchApplications();
        // refresh participants count for this opportunity (accepted count)
        await fetchParticipantsCount(oppId);
      } else {
        setError(msg);
      }
      showMessage(msg, "error");
    } finally {
      setIsApplying(false);
    }
  };

  const handleContactNgo = async () => {
    if (!selected || !me) return;
    const ngo = selected.ngo_id || selected.NGO_ID;
    const ngoId = (ngo && (ngo._id || ngo)) || null;
    if (!ngoId) return showMessage('NGO id not available', 'error');

    // Navigate to Messages and open a temporary DM view for this NGO
    // Do NOT create a conversation in the database yet — it will be created
    // only when the user sends the first message.
    navigate('/home/messages', { state: { openConversationOtherUserId: ngoId, openConversationOtherUserName: ngo && (ngo.fullName || ngo.name) } });
  };

  // socket listener: notification (volunteer receives accept/reject)
  useEffect(() => {
    const onNotif = async (notification) => {
      try {
        if (notification.type === "accepted" || notification.type === "rejected") {
          // notification.referenceId is the application id
          const appId = notification.referenceId;
          const status = notification.type;

          // Update the application in cache immediately
          updateApplicationInCache(queryClient, appId, status);

          // Find the matching application to get opportunity details
          const cachedApps = queryClient.getQueryData(["applications"]) || [];
          const matching = cachedApps.find((a) => String(a._id) === String(appId));
          
          if (matching && matching.opportunityId) {
            const oppId = matching.opportunityId._id || matching.opportunityId;
            setOpportunities((prev) => prev.map((o) => (String(o._id) === String(oppId) ? { ...o, status } : o)));
            if (selected && selected._id === oppId) {
              setSelected((s) => ({ ...s, status }));
            }
            // if the application status changed to accepted, refresh participants count
            if (status === 'accepted') {
              fetchParticipantsCount(oppId).catch(() => { });
            }
          }

          // Refetch applications to ensure embedded opportunity data is updated
          invalidateApplicationsCache(queryClient);
          await refetchApplications();

          // browser notification (animation is handled by Topbar/Bell via notify:incoming)
          if (document.hidden && Notification.permission === 'granted') {
            try { new Notification(`Application ${status}`); } catch (e) { }
            try { new Audio('./notify.mp3').play().catch(() => { }); } catch (e) { }
          }
        }
      } catch (e) { console.error(e); }
    };

    socket.on('notification', onNotif);
    return () => socket.off('notification', onNotif);
  }, [selected]);

  // Socket listeners for opportunity updates - also refetch applications since they embed opportunity data
  useEffect(() => {
    if (!socket) return;

    const handleOpportunityUpdate = () => {
      // When opportunity is updated, invalidate applications cache too since they embed opportunity data
      invalidateApplicationsCache(queryClient);
    };

    socket.on('opportunity:created', handleOpportunityUpdate);
    socket.on('opportunity:updated', handleOpportunityUpdate);
    socket.on('opportunity:deleted', handleOpportunityUpdate);

    return () => {
      socket.off('opportunity:created', handleOpportunityUpdate);
      socket.off('opportunity:updated', handleOpportunityUpdate);
      socket.off('opportunity:deleted', handleOpportunityUpdate);
    };
  }, [socket, queryClient]);

  // Ensure socket is connected for this user (Topbar normally connects, but
  // connect here if not already connected and we have user info).
  useEffect(() => {
    if (me && socket && !socket.connected) {
      console.debug('Opportunities: connecting socket because me is present');
      socket.connect();
    }
  }, [me]);

  // fetch participants count when an opportunity is selected
  useEffect(() => {
    if (!selected) return;
    const id = selected._id || selected.id;
    if (!id) return;
    fetchParticipantsCount(id).catch(() => { });
  }, [selected]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
        credentials: "include", // Send session cookie for secure endpoint
      });

      const data = await res.json();
      if (data.success) {
        setImgLink(data.url);
        console.log("Upload Success:", data.url);
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err) {
      setError(err.message || "Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelect = (opp) => {
    if (fromDashboard) {
      // Clear the global topbar search input (if present) and navigate to opportunities page
      try {
        const topInput = document.querySelector('.topbar-search');
        if (topInput) {
          topInput.value = '';
          // Dispatch input event so listeners pick up the change
          topInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (e) { }
      navigate('/home/opportunities', { state: { openId: opp._id || opp.id } });
      return;
    }

    // When user explicitly opens another opportunity, clear local search and open it
    setSearch("");
    setStatusFilter("all");
    setClosedManually(false);
    setSelectedBeforeSearch(null);
    setSelected(normalizeOpportunity(opp));
    setError("");
    // Scroll the opportunities container (or window) to top so details panel is visible
    setTimeout(() => {
      try {
        const page = document.querySelector('.opportunities-page');
        if (page && typeof page.scrollTo === 'function') {
          page.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (typeof window.scrollTo === 'function') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (e) { }
    }, 50);
  };

  // Close/open behavior tied to search input:
  // - If user types something (search non-empty) while a detail is open, close details but remember it
  // - If user clears the search and details were closed by search (not manually), reopen the remembered detail
  useEffect(() => {
    const hasSearch = Boolean(search && search.trim());
    const hasFilter = Boolean(statusFilter && statusFilter !== "all");

    // if search/filter has selection and a detail is open -> close it and remember
    if ((hasSearch || hasFilter) && selected) {
      setSelectedBeforeSearch(selected);
      setSelected(null);
      setClosedManually(false);
      return;
    }

    // if both search and filter are cleared and there is a remembered selection and details currently closed
    if (!hasSearch && !hasFilter && !selected && selectedBeforeSearch && !closedManually) {
      setSelected(selectedBeforeSearch);
      setSelectedBeforeSearch(null);
    }
    // If user clears search/filter but they had manually closed details earlier, do nothing
  }, [search, statusFilter]);

  // Sync with the global topbar search input (if present). The app uses the topbar
  // search across pages, so listen to its `input` events and mirror the value.
  // NOTE: This is now disabled - search is handled only in Topbar search results window

  // close composite menu on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      try {
        // debug
        // console.log('doc click', e.target, compositeRef.current);
        if (!compositeRef.current) return;
        if (!compositeRef.current.contains(e.target)) {
          // close when clicked outside
          setCompositeOpen(false);
        }
      } catch (err) { }
    };
    // Use capture phase so we catch clicks even if children call stopPropagation
    if (compositeOpen) document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [compositeOpen]);

  // If navigated here with an `openId` in the route state, open that opportunity in details
  useEffect(() => {
    if (!loc || !loc.state) return;
    const id = loc.state.openId;
    if (!id) return;
    // If opportunities already loaded, open immediately; otherwise wait for load
    if (opportunities && opportunities.length > 0) {
      const found = opportunities.find((o) => (o._id === id || o.id === id));
      if (found) setSelected(normalizeOpportunity(found));
    }
  }, [loc, opportunities]);

  // If route state asked to open create modal (from Dashboard), open it
  useEffect(() => {
    if (!loc || !loc.state) return;
    if (loc.state.openCreate) setShowCreate(true);
  }, [loc]);

  return (
    <div className={fromDashboard ? "opportunities-embedded" : "page opportunities-page"}>
      <div className="opps-header-row">
        {!hideHeader && (
          <div className="opps-title-block">
            <h2 className="opps-title">Volunteer Opportunities</h2>
            <p className="opps-subtitle">
              Browse and join recycling and waste management initiatives
            </p>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!hideFilter && (
              <div ref={compositeRef} className={`opps-composite-filter ${compositeOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="composite-label composite-btn"
                  aria-haspopup="true"
                  aria-expanded={compositeOpen}
                  onClick={() => setCompositeOpen((s) => !s)}
                >
                  Filter ▾
                </button>
                <div className="composite-menu" role="menu">
                  <div className={`menu-group ${scopeFilter === 'all' ? 'group-active' : ''}`}>
                    <div className="group-title">All Opportunities</div>
                    <button type="button" className={`menu-item ${scopeFilter === 'all' && statusFilter === 'all' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('all'); setSelected(null); setCompositeOpen(false); console.log('Filter selected', { scope: 'all', status: 'all' }); }}>All Statuses</button>
                    <button type="button" className={`menu-item ${scopeFilter === 'all' && statusFilter === 'open' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('open'); setSelected(null); setCompositeOpen(false); console.log('Filter selected', { scope: 'all', status: 'open' }); }}>Open</button>
                    <button type="button" className={`menu-item ${scopeFilter === 'all' && statusFilter === 'in-progress' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('in-progress'); setSelected(null); setCompositeOpen(false); console.log('Filter selected', { scope: 'all', status: 'in-progress' }); }}>In Progress</button>
                    <button type="button" className={`menu-item ${scopeFilter === 'all' && statusFilter === 'closed' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('closed'); setSelected(null); setCompositeOpen(false); console.log('Filter selected', { scope: 'all', status: 'closed' }); }}>Closed</button>
                  </div>
                  <div className={`menu-group ${scopeFilter === 'mine' ? 'group-active' : ''}`}>
                    <div className="group-title">My Opportunities</div>
                    <button type="button" className={`menu-item ${scopeFilter === 'mine' && statusFilter === 'all' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('mine'); setStatusFilter('all'); setSelected(null); setCompositeOpen(false); console.log('Filter selected', { scope: 'mine', status: 'all' }); }}>All Statuses</button>
                    <button type="button" className={`menu-item ${scopeFilter === 'mine' && statusFilter === 'open' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('mine'); setStatusFilter('open'); setSelected(null); setCompositeOpen(false); console.log('Filter selected', { scope: 'mine', status: 'open' }); }}>Open</button>
                    <button type="button" className={`menu-item ${scopeFilter === 'mine' && statusFilter === 'in-progress' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('mine'); setStatusFilter('in-progress'); setSelected(null); setCompositeOpen(false); console.log('Filter selected', { scope: 'mine', status: 'in-progress' }); }}>In Progress</button>
                    <button type="button" className={`menu-item ${scopeFilter === 'mine' && statusFilter === 'closed' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('mine'); setStatusFilter('closed'); setSelected(null); setCompositeOpen(false); console.log('Filter selected', { scope: 'mine', status: 'closed' }); }}>Closed</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {!(me && me.role === 'volunteer') && (
            <button className="btn btn-primary opps-create-btn" onClick={handleOpenCreate}>
              + Create Opportunity
            </button>
          )}
        </div>
      </div>

      {!topbarPresent && (
        <div className="opps-toolbar">
          <div className="opps-search-bar">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search opportunities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* toolbar filter removed - single composite filter in header */}
        </div>
      )}

      {selected && !showApplicantsView && (
        <div className="opps-details-panel">
          <div className="opps-details-top">
            <button
              className="opps-back-btn"
              type="button"
              onClick={() => {
                setSelected(null);
                setError("");
                setShowApplicantsView(false);
                setOpportunityApplicants([]);
              }}
            >
              ← Back to Opportunities
            </button>

            <div className={`status-pill status-${selected.status || "open"}`}>
              {(selected.status || "open").charAt(0).toUpperCase() +
                (selected.status || "open").slice(1)}
            </div>
          </div>

          <div className="opps-details-top-block">
            <div>
              <h3>{selected.title}</h3>
              <p className="opps-details-subtitle">Volunteer opportunity details</p>
            </div>
          </div>

          <div className="opps-details-main-block">
            <div className="opps-details-description">
              <h4>Description</h4>
              <p>{selected.description}</p>

              {Array.isArray(selected.required_skills) &&
                selected.required_skills.length > 0 && (
                  <div className="opps-details-section">
                    <h4>Required Skills</h4>
                    <div className="skill-list">
                      {selected.required_skills.map((s, i) => (
                        <div key={i} className="skill-item">{s}</div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="opps-details-row">
              <div className="opps-details-image-wrap">
                {selected.img_link ? (
                  <img
                    src={selected.img_link}
                    alt={selected.title}
                    className="opps-details-image full"
                    onClick={() => setImageOverlay(selected.img_link)}
                    style={{ cursor: 'zoom-in' }}
                  />
                ) : (
                  <div className="opps-details-image-placeholder">No image</div>
                )}
              </div>

              <aside className="opps-details-side">
                <h4>Opportunity Details</h4>
                <div className="details-list">
                  <div className="details-item">
                    <div className="details-icon"><CalendarIcon /></div>
                    <div className="details-text">
                      <label>Date : </label>
                      <span>{selected.date || "Not specified"}</span>
                    </div>
                  </div>
                  <div className="details-item">
                    <div className="details-icon"><ClockIcon /></div>
                    <div className="details-text">
                      <label>Duration : </label>
                      <span>{selected.duration || "Not specified"} {selected.duration == 1 ? "hour" : "hours"}</span>
                    </div>
                  </div>
                  <div className="details-item">
                    <div className="details-icon"><MapPinIcon /></div>
                    <div className="details-text">
                      <label>Location : </label>
                      <span>{formatLocationDisplay(selected.location, selected.city)}</span>
                    </div>
                  </div>
                  <div className="details-item">
                    <div className="details-icon"><UsersIcon /></div>
                    <div className="details-text">
                      <label>Participants : </label>
                      <span>{(participantsCountMap[selected._id || selected.id] || 0)} joined</span>
                    </div>
                  </div>
                  <div className="details-item">
                    <div className="details-icon"><UserIcon /></div>
                    <div className="details-text">
                      <label>Posted by : </label>
                      <span>{(selected.ngo_id && (selected.ngo_id.fullName || selected.ngo_id)) || "N/A"}</span>
                    </div>
                  </div>
                </div>
                {me?.role !== "volunteer" && String(selected?.ngo_id?._id || selected?.ngo_id) === String(me?.id || me?._id) && (
                  <div className="opps-details-actions">
                    <button className="btn details-edit-btn" type="button" onClick={() => handleOpenEdit(selected)}>
                      <EditIcon /> Edit
                    </button>
                    <button className="btn details-delete-btn" type="button" onClick={() => handleDeleteClick(selected)}>
                      <TrashIcon /> Delete
                    </button>
                  </div>
                )}
              </aside>
            </div>
            {me?.role !== "ngo" && !(me?.role === "volunteer" && selected?.status === "closed") && (
              <div className="opps-details-footer-btns">
                <button
                  className="apply-btn"
                  onClick={handleApply}
                  disabled={
                    isApplying ||
                    isParticipant ||
                    (userApp && (userApp.status === "accepted" || userApp.status === "pending" || userApp.status === "rejected"))
                  }
                >
                  <span>
                    {isApplying
                      ? "Applying..."
                      : isParticipant || (userApp && userApp.status === "accepted")
                        ? "You already joined in this event"
                        : userApp && userApp.status === "pending"
                          ? "Application is pending"
                          : userApp && userApp.status === "rejected"
                            ? "Your application is rejected"
                            : "Apply Now"}
                  </span>
                </button>

                {userApp && (
                  <button
                    className="apply-btn"
                    type="button"
                    onClick={() => setShowAppView(true)}
                  >
                    View Application
                  </button>
                )}

                <button
                  className="apply-btn"
                  type="button"
                  onClick={() => {
                    const loc = selected && selected.location;
                    if (!loc || loc.type !== 'Point' || !Array.isArray(loc.coordinates) || loc.coordinates.length < 2) {
                      showMessage('No coordinates available for this opportunity', 'info');
                      return;
                    }
                    const [lat, lon] = loc.coordinates;
                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lon)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  View Location
                </button>
                {(isParticipant || (userApp && userApp.status === 'accepted')) && (
                  <button
                    className="apply-btn"
                    type="button"
                    onClick={handleContactNgo}
                  >
                    Contact NGO
                  </button>
                )}
              </div>
            )}

            {/* NGO: View Applications button */}
            {me?.role === "ngo" && String(selected?.ngo_id?._id || selected?.ngo_id) === String(me?.id || me?._id) && (
              <div className="opps-details-footer-btns">
                <button
                  className="apply-btn"
                  type="button"
                  onClick={async () => {
                    const oppId = selected._id || selected.id;
                    if (!oppId) return;
                    setApplicantsLoading(true);
                    setOpportunityApplicants([]);
                    try {
                      const res = await fetch(`${API_BASE}/applications/opportunity/${oppId}`, { credentials: 'include' });
                      if (!res.ok) throw new Error('Failed to load applicants');
                      const data = await res.json();
                      setOpportunityApplicants(Array.isArray(data) ? data : []);
                    } catch (err) {
                      showMessage(err.message || 'Error loading applicants', 'error');
                    } finally {
                      setApplicantsLoading(false);
                    }
                    setShowApplicantsView(true);
                  }}
                >
                  View Applications
                </button>
                <button
                  className="apply-btn"
                  type="button"
                  onClick={() => {
                    const loc = selected && selected.location;
                    if (!loc || loc.type !== 'Point' || !Array.isArray(loc.coordinates) || loc.coordinates.length < 2) {
                      showMessage('No coordinates available for this opportunity', 'info');
                      return;
                    }
                    const [lat, lon] = loc.coordinates;
                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lon)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  View Location
                </button>
              </div>
            )}
          </div>

          {showAppView && userApp && (
            <VolunteerApplicationModal
              notif={{
                application: {
                  ...userApp,
                  opportunityId: (userApp.opportunityId && typeof userApp.opportunityId === 'object')
                    ? userApp.opportunityId
                    : selected
                }
              }}
              onClose={() => setShowAppView(false)}
              onAction={refetchApplications}
            />
          )}

          {imageOverlay && (
            <div className="image-overlay" onClick={() => setImageOverlay(null)}>
              <button className="image-overlay-close" onClick={(e) => { e.stopPropagation(); setImageOverlay(null); }}>← Back</button>
              <img src={imageOverlay} alt="Fullscreen" className="image-overlay-img" />
            </div>
          )}
        </div>
      )}

      {/* NGO: Applications List View — shown inside the details panel area */}
      {showApplicantsView && selected && (
        <div className="opp-applicants-view">
          {/* Opportunity title header + back button */}
          <div className="opp-applicants-header">
            <button
              type="button"
              className="opps-back-btn"
              onClick={() => {
                setShowApplicantsView(false);
                setSelectedApplicantNotif(null);
              }}
            >
              ← Back
            </button>
            <h3 className="opp-applicants-opp-title">{selected.title}</h3>
            <div style={{ width: 90 }} />{/* spacer to balance back btn */}
          </div>

          {/* Table headings */}
          <div className="opp-applicants-table">
            <div className="opp-applicants-row opp-applicants-heading-row">
              <div className="opp-applicants-col">Applicant Name</div>
              <div className="opp-applicants-col">Applied</div>
              <div className="opp-applicants-col">Status</div>
              <div className="opp-applicants-col">View Details</div>
            </div>

            {applicantsLoading && (
              <div className="opp-applicants-empty">Loading applicants...</div>
            )}
            {!applicantsLoading && opportunityApplicants.length === 0 && (
              <div className="opp-applicants-empty">No applications yet for this opportunity.</div>
            )}

            {!applicantsLoading && opportunityApplicants.map((app) => {
              const vol = app.volunteerId || {};
              const statusVal = (app.status || 'pending').toLowerCase();
              const statusColor = statusVal === 'accepted' ? '#08C18A' : statusVal === 'rejected' ? '#ff3b30' : '#f0ad4e';
              const appliedOn = formatRelativeTime(app.createdAt);
              return (
                <div key={app._id} className="opp-applicants-row">
                  <div className="opp-applicants-col">{vol.fullName || 'Unknown'}</div>
                  <div className="opp-applicants-col">{appliedOn}</div>
                  <div className="opp-applicants-col">
                    <span className="opp-applicants-status-pill" style={{ background: statusColor + '18', color: statusColor }}>
                      {statusVal.charAt(0).toUpperCase() + statusVal.slice(1)}
                    </span>
                  </div>
                  <div className="opp-applicants-col">
                    <button
                      type="button"
                      className="opp-applicants-view-btn"
                      onClick={() => {
                        setSelectedApplicantNotif({
                          _id: app._id,
                          type: 'application',
                          application: {
                            ...app,
                            opportunityId: selected,
                            volunteerId: vol,
                          }
                        });
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ApplicationModal popup for NGO when viewing applicant details from applicants list */}
      {selectedApplicantNotif && (
        <ApplicationModal
          notif={selectedApplicantNotif}
          onClose={() => setSelectedApplicantNotif(null)}
          onAction={async (applicationId, status) => {
            // Update in local list
            setOpportunityApplicants((prev) =>
              prev.map((a) => (String(a._id) === String(applicationId) ? { ...a, status } : a))
            );
            // Call respond endpoint
            try {
              const res = await fetch(`${API_BASE}/applications/${applicationId}/respond`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Failed to respond');
              showMessage(`Application ${status}!`, 'success');
            } catch (err) {
              showMessage(err.message || 'Error responding to application', 'error');
            }
            setSelectedApplicantNotif((s) => s ? { ...s, application: { ...(s.application || {}), status } } : s);
          }}
        />
      )}

      {error && <div className="field-error" style={{ marginTop: 8 }}>{error}</div>}
      {loading && <div style={{ marginTop: 8 }}>Loading opportunities...</div>}

      <div className="opps-grid">
        {filtered.map((opp) => (
          <div key={opp._id} className="opps-card">
            {opp.img_link ? (
              <div className="opps-card-img-wrap">
                <img src={opp.img_link} alt={opp.title} className="opps-card-img" />
              </div>
            ) : (
              <div className="opps-card-img-placeholder">No image available</div>
            )}
            <div className="opps-card-body">
              <div className="opps-card-header-row">
                <h4 className="opps-card-title">{opp.title}</h4>
                <span className={`status-pill status-${opp.status || "open"}`}>
                  {(opp.status || "open").charAt(0).toUpperCase() +
                    (opp.status || "open").slice(1)}
                </span>
              </div>
              <p className="opps-card-text">
                {opp.description && opp.description.length > 120
                  ? `${opp.description.slice(0, 117)}...`
                  : opp.description}
              </p>
              <div className="opps-card-meta">
                <div className="meta-item"><span className="icon-wrap" title={opp.date ? `Date: ${opp.date}` : 'Date not specified'}><CalendarIcon /></span> {opp.date || "N/A"}</div>
                <div className="meta-item"><span className="icon-wrap" title={formatLocationDisplay(opp.location, opp.city) ? `Location: ${formatLocationDisplay(opp.location, opp.city)}` : 'Location not specified'}><MapPinIcon /></span> {formatLocationDisplay(opp.location, opp.city) || "N/A"}</div>
                <div className="meta-item"><span className="icon-wrap" title="Participants"><UsersIcon /></span> {(participantsCountMap[opp._id || opp.id] || 0)} Participants</div>
                <div className="meta-item"><span className="icon-wrap" title={opp.duration ? `Duration: ${opp.duration}` : 'Duration not specified'}><ClockIcon /></span> {opp.duration || "N/A"} {opp.duration == 1 ? "hour" : "hours"}</div>
              </div>
              <div className="posted">Posted {formatRelativeTime(opp.createdAt)}</div>

              <button
                className="btn opps-card-btn"
                type="button"
                onClick={() => handleSelect(opp)}
              >
                {fromDashboard && me?.role === "volunteer" ? "Apply Now" : "View Details"}
              </button>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', width: '100%', gridColumn: '1 / -1' }}>
            <h1 style={{ color: 'var(--primary, #08C18A)', fontSize: '48px', fontWeight: '900', letterSpacing: '-1.5px', margin: 0 }}>
              Opportunities not found
            </h1>
            <p style={{ color: '#718096', fontSize: '18px', marginTop: '12px' }}>
              We couldn't find any opportunities matching your current filters.
            </p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="opps-create-overlay">
          <div className="opps-create-modal">
            <div className="opps-create-header">
              <h3>{editingId ? "Edit Opportunity" : "Create Opportunity"}</h3>
              <button
                type="button"
                className="opps-close-btn"
                onClick={() => setShowCreate(false)}
              >
                ✕
              </button>
            </div>
            <form className="opps-form" onSubmit={editingId ? handleUpdate : handleCreate}>
              <div className="form-row">
                <label>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Duration (in hours)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>
              <div className="form-row">
                <label>Location</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setMapOpen(true)}>Choose Location</button>
                  <span style={{ color: '#718096', fontSize: 13 }}>{locationCoords ? `${locationCoords.lat.toFixed(5)}, ${locationCoords.lon.toFixed(5)}` : 'No location selected'}</span>
                </div>
              </div>
              <div className="form-row">
                <label>City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Required Skills (comma separated)</label>
                <input
                  value={requiredSkills}
                  onChange={(e) => setRequiredSkills(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="form-row">
                <label>Upload Image</label>
                <div className="upload-container">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    className="file-input"
                  />
                  {isUploading && <span className="upload-status">Uploading...</span>}
                  {imgLink && !isUploading && (
                    <div className="upload-preview">
                      <img src={imgLink} alt="Preview" />
                      <button type="button" onClick={() => setImgLink("")} className="remove-img">✕</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="opps-form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || isUploading}
                >
                  {creating ? (editingId ? "Updating..." : "Creating...") : (isUploading ? "Uploading Image..." : (editingId ? "Update Opportunity" : "Create Opportunity"))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MapPicker
        open={mapOpen}
        initial={locationCoords ? [locationCoords.lat, locationCoords.lon] : null}
        onCancel={() => setMapOpen(false)}
        onChoose={(val) => {
          // val: { lat, lon, city }
          setLocationCoords({ lat: val.lat, lon: val.lon });
          if (val.city) setCity(val.city);
          setMapOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        message={confirmMessage}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirming={deleting}
        danger={true}
      />
      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
      <Loading isLoading={fetchedLoading || creating || isUploading || deleting || isApplying} />
    </div>
  );
};

const formatLocationDisplay = (loc, cityVal) => {
  // Always prefer explicit `city` value. We do not display raw coordinates
  // in the UI anymore to avoid exposing lat/lon strings.
  if (cityVal) return cityVal;
  return "Not specified";
};

export default Opportunities;