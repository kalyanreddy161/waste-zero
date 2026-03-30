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
import ActionButton from "./ActionButton";
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

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);

const MoreVerticalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.8"></circle>
    <circle cx="12" cy="12" r="1.8"></circle>
    <circle cx="12" cy="19" r="1.8"></circle>
  </svg>
);

const OPPORTUNITY_REPORT_REASONS = [
  "Spreading false information",
  "These types of opportunities are not allowed",
  "Misleading event details or location",
  "Repeated policy violations",
  "Suspicious or unsafe activity reported",
];

const OPPORTUNITY_MODERATION_REASON_PRESETS = [
  "Misleading event details or location",
  "These types of opportunities are not allowed",
  "Repeated policy violations",
  "Suspicious or unsafe activity reported",
  "Unsafe or harmful behaviour reported",
];

const OPPORTUNITY_MODERATION_DURATION_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "15", label: "15 days" },
  { value: "custom", label: "Custom input" },
];

const DEFAULT_OPPORTUNITY_MODERATION_STATE = {
  open: false,
  mode: "",
  duration: "1",
  customDays: "",
  deleteOpportunity: false,
  reason: "",
  reasonError: false,
};

const formatRestrictionUntil = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const buildRestrictionDialogMessage = (restrictedUntil, blockedAction) => {
  const formatted = formatRestrictionUntil(restrictedUntil);
  const actionText = blockedAction ? ` from ${blockedAction}` : "";

  if (!formatted) {
    return `You are currently restricted${actionText} by WasteZero admin.`;
  }

  return `You are currently restricted${actionText} until ${formatted}.`;
};

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
  // Apply confirm dialog
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);

  // NGO: View Applications for the selected opportunity
  const [showApplicantsView, setShowApplicantsView] = useState(false);
  const [opportunityApplicants, setOpportunityApplicants] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [selectedApplicantNotif, setSelectedApplicantNotif] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [closingReportModal, setClosingReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportReasonError, setReportReasonError] = useState(false);
  const [moderatingOpportunity, setModeratingOpportunity] = useState(false);
  const [showOpportunityActionMenu, setShowOpportunityActionMenu] = useState(false);
  const [reportSuccessDialogOpen, setReportSuccessDialogOpen] = useState(false);
  const [opportunityModerationState, setOpportunityModerationState] = useState(
    DEFAULT_OPPORTUNITY_MODERATION_STATE
  );
  const [restrictionDialog, setRestrictionDialog] = useState({ open: false, message: "" });

  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { data: applications = [], refetch: refetchApplications } = useApplications();
  const navigate = useNavigate();
  const loc = useLocation();
  const [topbarPresent, setTopbarPresent] = useState(true);
  const isFromDashboard = Boolean(fromDashboard || (loc && loc.state && loc.state.fromDashboard));
  const [scopeFilter, setScopeFilter] = useState(initialScopeFilter || 'all'); // 'all' | 'mine'
  const [compositeOpen, setCompositeOpen] = useState(false);
  const compositeRef = useRef(null);
  const opportunityActionMenuRef = useRef(null);
  const myId = me?.id || me?._id;
  const isAdmin = me?.role === "admin";
  const isNgo = me?.role === "ngo";
  const isVolunteer = me?.role === "volunteer";
  const minOpportunityDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
  }, []);

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

  const openRestrictionDialog = (message) => {
    setRestrictionDialog({
      open: true,
      message,
    });
  };

  const closeRestrictionDialog = () => {
    setRestrictionDialog({ open: false, message: "" });
  };

  const getActiveRestrictionUntil = () => {
    if (!me?.restrictedUntil) {
      return null;
    }

    const restrictedUntil = new Date(me.restrictedUntil);
    if (Number.isNaN(restrictedUntil.getTime()) || restrictedUntil <= new Date()) {
      return null;
    }

    return me.restrictedUntil;
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

  useEffect(() => {
    if (!isAdmin) return;
    if (scopeFilter !== "all") {
      setScopeFilter("all");
    }
  }, [initialStatusFilter, isAdmin, scopeFilter, statusFilter]);

  // Helper: haversine distance in meters
  const haversine = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371e3; // metres
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lon2 - lon1);
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
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
    if (!isAdmin && scopeFilter === 'mine') {
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
  }, [applications, isAdmin, me, myId, opportunities, search, statusFilter, scopeFilter]);

  useEffect(() => {
    const visibleIds = Array.isArray(filtered)
      ? filtered.map((opp) => opp?._id || opp?.id).filter(Boolean)
      : [];
    const missingIds = visibleIds.filter((id) => participantsCountMap[id] === undefined);

    if (missingIds.length === 0) return;

    let cancelled = false;

    Promise.all(
      missingIds.map(async (id) => {
        try {
          const res = await fetch(`${API_BASE}/opportunities/${id}/participants-count`, { credentials: "include" });
          if (!res.ok) return [id, 0];
          const data = await res.json();
          return [id, data.count || 0];
        } catch (err) {
          return [id, 0];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setParticipantsCountMap((current) => {
        const next = { ...(current || {}) };
        entries.forEach(([id, count]) => {
          next[id] = count;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [filtered, participantsCountMap]);

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

  // Ensure composite menu closes when filters change (covers any event propagation issues)
  useEffect(() => {
    if (compositeOpen) setCompositeOpen(false);
  }, [scopeFilter, statusFilter]);

  const handleOpenCreate = () => {
    const restrictedUntil = getActiveRestrictionUntil();
    if (restrictedUntil) {
      openRestrictionDialog(
        buildRestrictionDialogMessage(restrictedUntil, "creating opportunities")
      );
      return;
    }

    if (!isNgo) {
      showMessage("Only NGO accounts can create opportunities.", "error");
      return;
    }
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
      } catch (e) { }
      if (selected && selected._id === confirmId) setSelected(null);
      setConfirmOpen(false);
      setConfirmId(null);
      showMessage("Opportunity deleted", "success");
    } catch (err) {
      const msg = err.message || "Failed to delete opportunity";
      setError(msg);
      showMessage(msg, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!isNgo) {
      setError("Only NGO accounts can create opportunities.");
      return;
    }
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
        if (res.status === 403 && data?.restrictedUntil) {
          openRestrictionDialog(
            data.message ||
              buildRestrictionDialogMessage(
                data.restrictedUntil,
                "creating opportunities"
              )
          );
          return;
        }
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
      } catch (e) { }
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
      const msg = err.message || "Failed to create opportunity";
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
      } catch (e) { }
      // if this opportunity is currently open in details, update selected
      if (selected && (selected._id === norm._id)) {
        setSelected(norm);
      }

      setShowCreate(false);
      setEditingId(null);
      showMessage("Opportunity updated", "success");
    } catch (err) {
      const msg = err.message || "Failed to update opportunity";
      setError(msg);
      showMessage(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleApply = async () => {
    if (!selected || !me) return;
    const restrictedUntil = getActiveRestrictionUntil();
    if (restrictedUntil) {
      openRestrictionDialog(
        buildRestrictionDialogMessage(restrictedUntil, "applying to opportunities")
      );
      return;
    }
    if (!isVolunteer) {
      showMessage("Only volunteers can apply to opportunities.", "error");
      return;
    }
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
      if (!res.ok) {
        if (res.status === 403 && data?.restrictedUntil) {
          openRestrictionDialog(
            data.message ||
              buildRestrictionDialogMessage(
                data.restrictedUntil,
                "applying to opportunities"
              )
          );
          return;
        }
        throw new Error(data.message || "Failed to apply");
      }

      // optimistic update: mark selected as pending and update applications list
      setSelected((s) => ({ ...(s || {}), status: "pending" }));
      setOpportunities((prev) => prev.map((o) => (String(o._id) === String(oppId) ? { ...o, status: "pending" } : o)));
      
      // Update cache and refetch to get fresh data with populated opportunity fields
      invalidateApplicationsCache(queryClient);
      await refetchApplications();

      // notify user in UI
      showMessage("Application submitted!", "success");
    } catch (err) {
      const msg = err.message || "Failed to apply to the opportunity";
      if (msg === "Already applied") {
        // Already applied â€” nothing to change for participants count until accepted.
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
    // Do NOT create a conversation in the database yet â€” it will be created
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
      } catch (e) { }
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
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err) {
      setError(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelect = (opp) => {
    setShowOpportunityActionMenu(false);
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
    if (!isAdmin) {
      setStatusFilter("all");
    }
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
    const hasFilter = !isAdmin && Boolean(statusFilter && statusFilter !== "all");

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
  }, [search, statusFilter, isAdmin, selected, selectedBeforeSearch, closedManually]);

  // Sync with the global topbar search input (if present). The app uses the topbar
  // search across pages, so listen to its `input` events and mirror the value.
  // NOTE: This is now disabled - search is handled only in Topbar search results window

  // close composite menu on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      try {
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

  useEffect(() => {
    const onDocClick = (e) => {
      try {
        if (!opportunityActionMenuRef.current) return;
        if (!opportunityActionMenuRef.current.contains(e.target)) {
          setShowOpportunityActionMenu(false);
        }
      } catch (err) { }
    };

    if (showOpportunityActionMenu) {
      document.addEventListener("click", onDocClick, true);
    }

    return () => document.removeEventListener("click", onDocClick, true);
  }, [showOpportunityActionMenu]);

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
    if (loc.state.openCreate && isNgo) setShowCreate(true);
  }, [isNgo, loc]);

  const resetReportModalState = () => {
    setReportReason("");
    setReportReasonError(false);
    setClosingReportModal(false);
    setModeratingOpportunity(false);
  };

  const handleOpenReportModal = () => {
    setShowOpportunityActionMenu(false);
    resetReportModalState();
    setShowReportModal(true);
  };

  const handleCloseReportModal = () => {
    setClosingReportModal(true);
    window.setTimeout(() => {
      setShowReportModal(false);
      resetReportModalState();
    }, 220);
  };

  const handleOpportunityReport = async () => {
    if (!selected) return;

    const trimmedReason = reportReason.trim();
    if (!trimmedReason) {
      setReportReasonError(true);
      return;
    }

    setModeratingOpportunity(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/opportunities/${selected._id || selected.id}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: trimmedReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit report");
      }

      handleCloseReportModal();
      setReportSuccessDialogOpen(true);
    } catch (err) {
      const msg = err.message || "Failed to submit report";
      setError(msg);
      showMessage(msg, "error");
    } finally {
      setModeratingOpportunity(false);
    }
  };

  const resetOpportunityModerationState = () => {
    setOpportunityModerationState({
      ...DEFAULT_OPPORTUNITY_MODERATION_STATE,
    });
  };

  const openOpportunityModerationModal = (mode) => {
    setShowOpportunityActionMenu(false);
    setOpportunityModerationState({
      ...DEFAULT_OPPORTUNITY_MODERATION_STATE,
      open: true,
      mode,
      duration: mode === "suspend" ? "7" : "1",
    });
  };

  const closeOpportunityModerationModal = () => {
    resetOpportunityModerationState();
    setModeratingOpportunity(false);
  };

  const updateOpportunityModerationState = (patch) => {
    setOpportunityModerationState((current) => ({
      ...current,
      ...patch,
    }));
  };

  const resolveOpportunityModerationDays = () => {
    if (opportunityModerationState.duration === "custom") {
      return Number(opportunityModerationState.customDays);
    }

    return Number(opportunityModerationState.duration);
  };

  const handleModerateOpportunityOwner = async () => {
    if (!selected || !opportunityModerationState.mode) return;

    const trimmedReason = opportunityModerationState.reason.trim();
    if (!trimmedReason) {
      updateOpportunityModerationState({ reasonError: true });
      return;
    }

    const durationDays = resolveOpportunityModerationDays();
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      showMessage("Please enter a valid moderation duration.", "error");
      return;
    }

    setModeratingOpportunity(true);
    setError("");

    try {
      const selectedId = selected._id || selected.id;
      const res = await fetch(`${API_BASE}/admin/opportunities/${selectedId}/moderate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: opportunityModerationState.mode,
          durationDays,
          deleteOpportunity: opportunityModerationState.deleteOpportunity,
          reason: trimmedReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to moderate opportunity owner");
      }

      if (data.deletedOpportunityId && String(selectedId) === String(data.deletedOpportunityId)) {
        setSelected(null);
      }
      closeOpportunityModerationModal();
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] }).catch(() => { });
      showMessage(data.message || "Opportunity owner updated successfully", "success");
    } catch (err) {
      const msg = err.message || "Failed to moderate opportunity owner";
      setError(msg);
      showMessage(msg, "error");
    } finally {
      setModeratingOpportunity(false);
    }
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {!hideFilter && (
              <div ref={compositeRef} className={`opps-composite-filter ${compositeOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="composite-label composite-btn"
                  aria-haspopup="true"
                  aria-expanded={compositeOpen}
                  onClick={() => setCompositeOpen((s) => !s)}
                >
                  Filter 
                </button>
                <div className="composite-menu" role="menu">
                  <button
                    type="button"
                    className="composite-close"
                    aria-label="Close filters"
                    onClick={() => setCompositeOpen(false)}
                  >
                    ×
                  </button>
                  {isAdmin ? (
                    <div className="menu-group group-active">
                      <div className="group-title">Opportunity status</div>
                      <button type="button" className={`menu-item ${statusFilter === 'all' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('all'); setSelected(null); setCompositeOpen(false); }}>All Statuses</button>
                      <button type="button" className={`menu-item ${statusFilter === 'open' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('open'); setSelected(null); setCompositeOpen(false); }}>Open</button>
                      <button type="button" className={`menu-item ${statusFilter === 'in-progress' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('in-progress'); setSelected(null); setCompositeOpen(false); }}>In Progress</button>
                      <button type="button" className={`menu-item ${statusFilter === 'closed' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('closed'); setSelected(null); setCompositeOpen(false); }}>Closed</button>
                    </div>
                  ) : (
                    <>
                      <div className={`menu-group ${scopeFilter === 'all' ? 'group-active' : ''}`}>
                        <div className="group-title">All Opportunities</div>
                        <button type="button" className={`menu-item ${scopeFilter === 'all' && statusFilter === 'all' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('all'); setSelected(null); setCompositeOpen(false); }}>All Statuses</button>
                        <button type="button" className={`menu-item ${scopeFilter === 'all' && statusFilter === 'open' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('open'); setSelected(null); setCompositeOpen(false); }}>Open</button>
                        <button type="button" className={`menu-item ${scopeFilter === 'all' && statusFilter === 'in-progress' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('in-progress'); setSelected(null); setCompositeOpen(false); }}>In Progress</button>
                        <button type="button" className={`menu-item ${scopeFilter === 'all' && statusFilter === 'closed' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('all'); setStatusFilter('closed'); setSelected(null); setCompositeOpen(false); }}>Closed</button>
                      </div>
                      <div className={`menu-group ${scopeFilter === 'mine' ? 'group-active' : ''}`}>
                        <div className="group-title">{isVolunteer ? "My Applications" : "My Opportunities"}</div>
                        <button type="button" className={`menu-item ${scopeFilter === 'mine' && statusFilter === 'all' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('mine'); setStatusFilter('all'); setSelected(null); setCompositeOpen(false); }}>All Statuses</button>
                        <button type="button" className={`menu-item ${scopeFilter === 'mine' && statusFilter === 'open' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('mine'); setStatusFilter('open'); setSelected(null); setCompositeOpen(false); }}>Open</button>
                        <button type="button" className={`menu-item ${scopeFilter === 'mine' && statusFilter === 'in-progress' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('mine'); setStatusFilter('in-progress'); setSelected(null); setCompositeOpen(false); }}>In Progress</button>
                        <button type="button" className={`menu-item ${scopeFilter === 'mine' && statusFilter === 'closed' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setScopeFilter('mine'); setStatusFilter('closed'); setSelected(null); setCompositeOpen(false); }}>Closed</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          {isNgo && (
            <ActionButton type="button" icon="plus" tone="primary" minWidth={210} onClick={handleOpenCreate}>
              Create Opportunity
            </ActionButton>
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
          <div className="opps-details-hero">
            <div className="opps-details-hero-main">
              <ActionButton
                type="button"
                icon="back"
                tone="neutral"
                size="sm"
                minWidth={194}
                className="opps-back-action"
                onClick={() => {
                  setShowOpportunityActionMenu(false);
                  resetOpportunityModerationState();
                  setSelected(null);
                  setError("");
                  setShowApplicantsView(false);
                  setOpportunityApplicants([]);
                }}
              >
                Back to Opportunities
              </ActionButton>

              <div className="opps-details-hero-copy">
                <span className="opps-details-kicker">Opportunity overview</span>
                <h3>{selected.title}</h3>
                <p>
                  Review the event schedule, location, participation details, and role-based actions in one place.
                </p>
              </div>
            </div>

            <div className="opps-details-hero-side">
              <div className={`status-pill status-${selected.status || "open"}`}>
                {(selected.status || "open").charAt(0).toUpperCase() +
                  (selected.status || "open").slice(1)}
              </div>

              {isVolunteer && (
                <div
                  className="opps-report-menu-wrap"
                  ref={opportunityActionMenuRef}
                >
                  <button
                    type="button"
                    className="opps-report-menu-trigger"
                    aria-label="Opportunity actions"
                    onClick={() =>
                      setShowOpportunityActionMenu((current) => !current)
                    }
                  >
                    <MoreVerticalIcon />
                  </button>
                  {showOpportunityActionMenu && (
                    <div className="opps-report-menu">
                      <button
                        type="button"
                        className="opps-report-menu-item"
                        onClick={handleOpenReportModal}
                      >
                        Report NGO
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div
            className={`opps-details-top-content ${
              Array.isArray(selected.required_skills) &&
              selected.required_skills.length > 0
                ? ""
                : "opps-details-top-content--single"
            }`}
          >
            <div className="opps-details-description-card">
              <div className="opps-details-panel-head">
                <h4>Description</h4>
                <p>Read the full event purpose, work expectations, and context before applying.</p>
              </div>
              <div className="opps-details-description">
                <p>{selected.description}</p>
              </div>
            </div>

            {Array.isArray(selected.required_skills) &&
              selected.required_skills.length > 0 && (
                <div className="opps-details-section-card">
                  <div className="opps-details-panel-head">
                    <h4>Required Skills</h4>
                    <p>These skills help volunteers understand what the NGO expects for the event.</p>
                  </div>
                  <div className="skill-list">
                    {selected.required_skills.map((s, i) => (
                      <div key={i} className="skill-item">{s}</div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <div className="opps-details-layout opps-details-layout-redesigned">
            <div className="opps-details-main">
              <div className="opps-details-media-card">
                <div className="opps-details-panel-head">
                  <h4>Event image</h4>
                  <p>Open the image for a closer look if the NGO uploaded one.</p>
                </div>
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
              </div>
            </div>

            <aside className="opps-details-side">
              <div className="opps-details-side-head">
                <h4>Action Center</h4>
              </div>
              <div className="details-list">
                <div className="details-item">
                  <div className="details-icon"><CalendarIcon /></div>
                  <div className="details-text">
                    <label>Date</label>
                    <span>{selected.date || "Not specified"}</span>
                  </div>
                </div>
                <div className="details-item">
                  <div className="details-icon"><ClockIcon /></div>
                  <div className="details-text">
                    <label>Duration</label>
                    <span>{selected.duration || "Not specified"} {selected.duration == 1 ? "hour" : "hours"}</span>
                  </div>
                </div>
                <div className="details-item">
                  <div className="details-icon"><MapPinIcon /></div>
                  <div className="details-text">
                    <label>Location</label>
                    <span>{formatLocationDisplay(selected.location, selected.city)}</span>
                  </div>
                </div>
                <div className="details-item">
                  <div className="details-icon"><UsersIcon /></div>
                  <div className="details-text">
                    <label>Participants</label>
                    <span>{(participantsCountMap[selected._id || selected.id] || 0)} joined</span>
                  </div>
                </div>
                <div className="details-item">
                  <div className="details-icon"><UserIcon /></div>
                  <div className="details-text">
                    <label>Posted by</label>
                    <span>{(selected.ngo_id && (selected.ngo_id.fullName || selected.ngo_id)) || "N/A"}</span>
                  </div>
                </div>
              </div>
              {me?.role !== "volunteer" && String(selected?.ngo_id?._id || selected?.ngo_id) === String(me?.id || me?._id) && (
                <div className="opps-details-actions">
                  <ActionButton
                    type="button"
                    icon="edit"
                    tone="primary"
                    size="sm"
                    minWidth={196}
                    className="opps-detail-action-button"
                    onClick={() => handleOpenEdit(selected)}
                  >
                    Edit
                  </ActionButton>
                  <ActionButton
                    type="button"
                    icon="delete"
                    tone="danger"
                    size="sm"
                    minWidth={196}
                    className="opps-detail-action-button"
                    onClick={() => handleDeleteClick(selected)}
                  >
                    Delete
                  </ActionButton>
                </div>
              )}
              <div className="opps-details-actions opps-view-location-row">
                <ActionButton
                  type="button"
                  icon="location"
                  tone="info"
                  size="sm"
                  minWidth={196}
                  className="opps-detail-action-button"
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
                </ActionButton>
              </div>
              {isAdmin && (
                <div className="opps-admin-moderation">
                  <div className="opps-admin-moderation-copy">
                    <strong>Admin Review</strong>
                    <p>Take direct action on this opportunity if the NGO is violating platform guidelines.</p>
                  </div>
                  <div className="opps-details-actions opps-admin-moderation-actions">
                    <ActionButton
                      type="button"
                      icon="restrict"
                      tone="warning"
                      size="sm"
                      minWidth={196}
                      className="opps-detail-action-button"
                      onClick={() => openOpportunityModerationModal("restrict")}
                      disabled={moderatingOpportunity}
                    >
                      Restrict NGO
                    </ActionButton>
                    <ActionButton
                      type="button"
                      icon="suspend"
                      tone="danger"
                      size="sm"
                      minWidth={196}
                      className="opps-detail-action-button"
                      onClick={() => openOpportunityModerationModal("suspend")}
                      disabled={moderatingOpportunity}
                    >
                      Suspend NGO
                    </ActionButton>
                  </div>
                </div>
              )}
            </aside>
          </div>

            {!isAdmin && me?.role !== "ngo" && !(me?.role === "volunteer" && selected?.status === "closed") && (
              <div className="opps-details-footer-btns">
                {/* Single adaptive apply/status button */}
                <button
                  className="button"
                  onClick={() => {
                    // If already has an application (pending/accepted/rejected), open the application view
                    if (userApp) {
                      setShowAppView(true);
                      return;
                    }
                    // Otherwise prompt confirm dialog to apply
                    setApplyConfirmOpen(true);
                  }}
                  disabled={isApplying}
                >
                  <span>
                    {isApplying
                      ? "Applying..."
                      : isParticipant || (userApp && userApp.status === "accepted")
                        ? "Application Accepted"
                        : userApp && userApp.status === "pending"
                          ? "Application Pending"
                          : userApp && userApp.status === "rejected"
                            ? "Application Rejected"
                            : "Apply Now"}
                  </span>
                  <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </button>

                {(isParticipant || (userApp && userApp.status === 'accepted')) && (
                  <button
                    className="button"
                    type="button"
                    onClick={handleContactNgo}
                  >
                    Contact NGO
                    <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* NGO: View Applications button */}
            {me?.role === "ngo" && String(selected?.ngo_id?._id || selected?.ngo_id) === String(me?.id || me?._id) && (
              <div className="opps-details-footer-btns">
                <button
                  className="button"
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
                      showMessage(err.message || 'Failed to load applicants', 'error');
                    } finally {
                      setApplicantsLoading(false);
                    }
                    setShowApplicantsView(true);
                  }}
                >
                  View Applications
                  <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </button>
              </div>
            )}
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
              onNotify={showMessage}
            />
          )}

          {imageOverlay && (
            <div className="image-overlay" onClick={() => setImageOverlay(null)}>
              <ActionButton
                type="button"
                icon="back"
                tone="neutral"
                size="sm"
                minWidth={140}
                className="image-overlay-close"
                onClick={(e) => { e.stopPropagation(); setImageOverlay(null); }}
              >
                Back
              </ActionButton>
              <img src={imageOverlay} alt="Fullscreen" className="image-overlay-img" />
            </div>
          )}

        </div>
      )}

      {/* NGO: Applications List View â€” shown inside the details panel area */}
      {showApplicantsView && selected && (
        <div className="opp-applicants-view">
          {/* Opportunity title header + back button */}
          <div className="opp-applicants-header">
            <ActionButton
              type="button"
              icon="back"
              tone="neutral"
              minWidth={140}
              onClick={() => {
                setShowApplicantsView(false);
                setSelectedApplicantNotif(null);
              }}
            >
              Back
            </ActionButton>
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
                    <ActionButton
                      type="button"
                      icon="eye"
                      tone="info"
                      size="sm"
                      minWidth={160}
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
                    </ActionButton>
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
            try {
              const res = await fetch(`${API_BASE}/applications/${applicationId}/respond`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message || 'Failed to respond to the application');

              setOpportunityApplicants((prev) =>
                prev.map((a) => (String(a._id) === String(applicationId) ? { ...a, status } : a))
              );
              setSelectedApplicantNotif((current) =>
                current
                  ? { ...current, application: { ...(current.application || {}), status } }
                  : current
              );

              const currentOppId = selected?._id || selected?.id;
              if (currentOppId) {
                fetchParticipantsCount(currentOppId).catch(() => { });
              }

              showMessage(
                status === "accepted"
                  ? "Application accepted successfully."
                  : "Application rejected successfully.",
                'success'
              );
            } catch (err) {
              showMessage(err.message || 'Failed to respond to the application', 'error');
            }
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
                className="button opps-card-btn"
                type="button"
                onClick={() => handleSelect(opp)}
              >
                {fromDashboard && me?.role === "volunteer" ? "Apply Now" : "View Details"}
              </button>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '60px 20px', width: '100%', gridColumn: '1 / -1' }}>
            <div className="page-header-wrapper">
              <h1 className="page-header" style={{ color: 'var(--primary, #08C18A)' }}>Opportunities not found</h1>
              <p className="page-subtitle" style={{ color: '#718096', fontSize: '18px', marginTop: '12px' }}>We couldn't find any opportunities matching your current filters.</p>
            </div>
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
                x
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
                  min={minOpportunityDate}
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
                  <span className="opps-location-hint">{locationCoords ? `${locationCoords.lat.toFixed(5)}, ${locationCoords.lon.toFixed(5)}` : 'No location selected'}</span>
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
                      <button type="button" onClick={() => setImgLink("")} className="remove-img">x</button>
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

      {showReportModal && selected && (
        <div
          className={`opps-report-overlay ${closingReportModal ? "closing" : ""}`}
          onClick={handleCloseReportModal}
        >
          <div
            className={`opps-report-modal ${closingReportModal ? "closing" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="opps-report-header">
              <div>
                <h3>Report NGO</h3>
                <p>Select the reason for reporting "{selected.title}" to admin.</p>
              </div>
              <ActionButton
                type="button"
                icon="close"
                tone="neutral"
                size="sm"
                minWidth={124}
                onClick={handleCloseReportModal}
              >
                Close
              </ActionButton>
            </div>

            <div className="opps-report-body">
              <label className="opps-report-label" htmlFor="opportunity-report-reason">
                Reason
              </label>
              <select
                id="opportunity-report-reason"
                className={`opps-report-select ${reportReasonError ? "error" : ""}`}
                value={reportReason}
                onChange={(e) => {
                  setReportReason(e.target.value);
                  if (reportReasonError) setReportReasonError(false);
                }}
              >
                <option value="">Select a reason</option>
                {OPPORTUNITY_REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div className="opps-report-actions">
              <ActionButton
                type="button"
                icon="report"
                tone="danger"
                minWidth={168}
                onClick={handleOpportunityReport}
                disabled={moderatingOpportunity}
              >
                {moderatingOpportunity ? "Submitting..." : "Report NGO"}
              </ActionButton>
              <ActionButton
                type="button"
                icon="close"
                tone="neutral"
                minWidth={144}
                onClick={handleCloseReportModal}
                disabled={moderatingOpportunity}
              >
                Close
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {opportunityModerationState.open && selected && (
        <div
          className="opps-report-overlay"
          onClick={() => {
            if (!moderatingOpportunity) {
              closeOpportunityModerationModal();
            }
          }}
        >
          <div
            className="opps-report-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="opps-report-header">
              <div>
                <h3>
                  {opportunityModerationState.mode === "suspend"
                    ? "Suspend NGO"
                    : "Restrict NGO"}
                </h3>
                <p>
                  Review "{selected.title}" and choose the moderation action for the NGO that posted it.
                </p>
              </div>
              <ActionButton
                type="button"
                icon="close"
                tone="neutral"
                size="sm"
                minWidth={124}
                onClick={closeOpportunityModerationModal}
                disabled={moderatingOpportunity}
              >
                Close
              </ActionButton>
            </div>

            <div className="opps-report-body">
              <label className="opps-report-label" htmlFor="opportunity-moderation-reason">
                Reason
              </label>
              <textarea
                id="opportunity-moderation-reason"
                className={`opps-report-input ${opportunityModerationState.reasonError ? "error" : ""}`}
                value={opportunityModerationState.reason}
                onChange={(e) =>
                  updateOpportunityModerationState({
                    reason: e.target.value,
                    reasonError: false,
                  })
                }
                placeholder="Explain why this opportunity needs admin action."
                rows={5}
                style={{ minHeight: 120, resize: "vertical" }}
              />

              <div className="opps-report-suggestions">
                {OPPORTUNITY_MODERATION_REASON_PRESETS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className={`opps-report-chip ${opportunityModerationState.reason === reason ? "active" : ""}`}
                    onClick={() =>
                      updateOpportunityModerationState({
                        reason,
                        reasonError: false,
                      })
                    }
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="opps-report-duration">
                <label className="opps-report-label" htmlFor="opportunity-moderation-duration">
                  Duration
                </label>
                <select
                  id="opportunity-moderation-duration"
                  className="opps-report-select"
                  value={opportunityModerationState.duration}
                  onChange={(e) =>
                    updateOpportunityModerationState({
                      duration: e.target.value,
                    })
                  }
                >
                  {OPPORTUNITY_MODERATION_DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {opportunityModerationState.duration === "custom" && (
                  <input
                    type="number"
                    min="1"
                    className="opps-report-input"
                    value={opportunityModerationState.customDays}
                    onChange={(e) =>
                      updateOpportunityModerationState({
                        customDays: e.target.value,
                      })
                    }
                    placeholder="Enter number of days"
                  />
                )}
              </div>

              <label className="opps-report-checkbox">
                <input
                  type="checkbox"
                  checked={opportunityModerationState.deleteOpportunity}
                  onChange={(e) =>
                    updateOpportunityModerationState({
                      deleteOpportunity: e.target.checked,
                    })
                  }
                />
                Delete this opportunity from listings
              </label>
            </div>

            <div className="opps-report-actions">
              <ActionButton
                type="button"
                icon={opportunityModerationState.mode === "suspend" ? "suspend" : "restrict"}
                tone={opportunityModerationState.mode === "suspend" ? "danger" : "warning"}
                minWidth={174}
                onClick={handleModerateOpportunityOwner}
                disabled={moderatingOpportunity}
              >
                {moderatingOpportunity
                  ? "Submitting..."
                  : opportunityModerationState.mode === "suspend"
                    ? "Suspend NGO"
                    : "Restrict NGO"}
              </ActionButton>
              <ActionButton
                type="button"
                icon="close"
                tone="neutral"
                minWidth={144}
                onClick={closeOpportunityModerationModal}
                disabled={moderatingOpportunity}
              >
                Close
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      <MapPicker
        open={mapOpen}
        initial={
          locationCoords
            ? [locationCoords.lat, locationCoords.lon]
            : (me?.location?.coordinates?.length === 2
              ? [me.location.coordinates[1], me.location.coordinates[0]]
              : null)
        }
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
      {/* Apply confirm dialog */}
      <ConfirmDialog
        open={applyConfirmOpen}
        message={`Are you sure you want to apply for "${selected?.title || 'this opportunity'}"?`}
        onConfirm={async () => {
          setApplyConfirmOpen(false);
          await handleApply();
        }}
        onCancel={() => setApplyConfirmOpen(false)}
        confirmLabel="Apply"
        cancelLabel="Cancel"
        confirming={isApplying}
        danger={false}
        buttonType="apply"
      />
      <ConfirmDialog
        open={reportSuccessDialogOpen}
        title="Reported"
        message="Thank you for reporting. Our admin team will review this issue."
        onConfirm={() => setReportSuccessDialogOpen(false)}
        onCancel={() => setReportSuccessDialogOpen(false)}
        confirmLabel="Close"
        hideCancel={true}
        buttonType="report"
      />
      <ConfirmDialog
        open={restrictionDialog.open}
        message={restrictionDialog.message}
        onConfirm={closeRestrictionDialog}
        onCancel={closeRestrictionDialog}
        confirmLabel="OK"
        cancelLabel="Close"
      />
      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
      <Loading isLoading={fetchedLoading || creating || isUploading || deleting || isApplying || moderatingOpportunity} />
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

