import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import { useMe, API_BASE } from "../Services/useMe";
import socket from "../Services/socket";
import ConfirmDialog from "./ConfirmDialog";
import CongratulationsDialog from "./CongratulationsDialog";
import MessageBox from "./MessageBox";
import Loading from "./Loading";
import MapPicker from "./MapPicker";
import ActionButton from "./ActionButton";
import "../styles/NavbarComponents-styles/SchedulePickup.css";

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

const PICKUP_REPORT_REASONS = [
  "Harassment or abusive language",
  "Suspicious or unsafe activity reported",
  "False or misleading pickup details",
  "No-show or repeated coordination issues",
  "Other inappropriate behaviour",
];

const digitsOnly = (value = "") => String(value || "").replace(/\D/g, "").slice(0, 10);

const buildPickupAddress = (pickupObj) =>
  [
    pickupObj?.address?.street,
    pickupObj?.address?.village,
    pickupObj?.address?.city,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ") || "Not available";

let recyclePdfIconPromise = null;

const loadSvgAsPngDataUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load recycle icon");
  }

  const svgText = await response.text();
  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to render recycle icon"));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const getRecyclePdfIcon = async () => {
  if (!recyclePdfIconPromise) {
    recyclePdfIconPromise = loadSvgAsPngDataUrl("/recycle_icon.svg");
  }

  return recyclePdfIconPromise;
};

// ----------------------------------------
// --- WheelPicker Component             ---
// ----------------------------------------
const WheelPicker = ({ options, value, onChange, height = 132 }) => {
  const itemHeight = 44;
  const containerRef = useRef(null);
  const scrollTimeout = useRef(null);

  const getIndex = () => options.findIndex(opt => (opt.value !== undefined ? opt.value.getTime ? opt.value.getTime() === value.getTime() : opt.value === value : opt === value));

  useEffect(() => {
    if (containerRef.current) {
      const index = getIndex();
      if (index > -1) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    }
  }, [value, options]);

  const handleScroll = (e) => {
    const el = e.target;
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const index = Math.round(el.scrollTop / itemHeight);
      if (options[index]) {
        const optValue = options[index].value !== undefined ? options[index].value : options[index];
        if (optValue !== value) onChange(options[index]);
      }
    }, 150);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height,
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        position: 'relative',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        width: '100%',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        background: 'var(--surface-primary)'
      }}
    >
      <style>{`
        .wheel-container::-webkit-scrollbar { display: none; }
      `}</style>
      <div className="wheel-container" style={{ height: (height - itemHeight) / 2 }} />
      {options.map((opt, i) => {
        const optValue = opt.value !== undefined ? opt.value : opt;
        const isSelected = value.getTime ? optValue.getTime() === value.getTime() : value === optValue;
        return (
          <div
            key={i}
            onClick={() => {
              onChange(opt);
              if (containerRef.current) {
                containerRef.current.scrollTo({ top: i * itemHeight, behavior: 'smooth' });
              }
            }}
            style={{
              height: itemHeight,
              scrollSnapAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isSelected ? '24px' : '16px',
              fontWeight: isSelected ? '700' : '500',
              color: isSelected ? 'var(--primary)' : 'var(--text-disabled)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              userSelect: 'none'
            }}
          >
            {opt.label || opt}
          </div>
        );
      })}
      <div style={{ height: (height - itemHeight) / 2 }} />
      <div style={{ position: 'absolute', top: (height - itemHeight) / 2, left: 0, right: 0, height: itemHeight, borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', pointerEvents: 'none', background: 'var(--surface-success-soft)' }} />
    </div>
  );
};

// ----------------------------------------
// --- 1. PickupDetails Inline Block    ---
// ----------------------------------------
const PickupDetailsInline = ({ pickup, role, me, onClaim, onComplete, onEdit, onDelete, onDownloadPdf, onClose, onReport }) => {
  if (!pickup) return null;

  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [claimErrors, setClaimErrors] = useState({ name: false, phone: false });
  const [claiming, setClaiming] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false });
  const [viewMapCoords, setViewMapCoords] = useState(null);

  // Note: pickup changes perfectly unmount because we supply a unique key natively to this component

  const combinedAddress = [pickup.address?.street, pickup.address?.village, pickup.address?.city]
    .filter(Boolean)
    .join(" - ");

  const volunteerName = pickup.userId?.fullName || "Volunteer";
  const dateString = new Date(pickup.pickupDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const timeString = new Date(pickup.pickupDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const myId = me?.id || me?._id;
  const isAdminViewer = role === "admin";
  const canReportCounterpart =
    pickup.status === "accepted" &&
    (
      (role === "volunteer" &&
        String(pickup.userId?._id || pickup.userId) === String(myId) &&
        Boolean(pickup.ngoId)) ||
      (role === "ngo" &&
        Boolean(pickup.ngoId) &&
        String(pickup.ngoId?._id || pickup.ngoId) === String(myId) &&
        Boolean(pickup.userId))
    );
  const statusLabel = pickup.status
    ? pickup.status.charAt(0).toUpperCase() + pickup.status.slice(1)
    : "Scheduled";
  const assignedNgoName = pickup.ngoId?.fullName || "Assigned NGO";
  const canDownloadPdf =
    role === "ngo" &&
    pickup.status === "accepted" &&
    pickup.ngoId &&
    String(pickup.ngoId._id || pickup.ngoId) === String(me?.id || me?._id);
  const pickupSummaryRows = [
    { label: "Volunteer", value: volunteerName },
    { label: "Phone", value: pickup.phone || pickup.userId?.phone || "N/A" },
    { label: "Waste Type", value: pickup.wasteType || "N/A" },
    { label: "Quantity", value: pickup.quantity != null ? `${pickup.quantity} kg` : "N/A" },
    { label: "Date", value: dateString },
    { label: "Time", value: timeString },
  ];
  const locationInfoRows = [
    { label: "Collection address", value: combinedAddress || "Location unavailable" },
    { label: "Claimed by", value: pickup.ngoId ? assignedNgoName : "Not claimed yet" },
  ];

  if (pickup.status !== "scheduled" && pickup.agent?.name) {
    locationInfoRows.push(
      { label: "Agent name", value: pickup.agent.name },
      { label: "Agent phone", value: pickup.agent.phone || "N/A" }
    );
  }

  const handleClaimCancel = () => {
    setClaiming(false);
    setClaimErrors({ name: false, phone: false });
  };

  const handleConfirmClaim = () => {
    const trimmedName = String(agentName || "").trim();
    const trimmedPhone = digitsOnly(agentPhone);
    const nextErrors = {
      name: !trimmedName,
      phone: trimmedPhone.length !== 10,
    };

    if (nextErrors.name || nextErrors.phone) {
      setClaimErrors(nextErrors);
      return;
    }

    setClaimErrors({ name: false, phone: false });
    onClaim(pickup._id, { name: trimmedName, phone: trimmedPhone });
  };

  // --- MAP VIEW: shown when user clicks "See Location in Maps" ---
  if (viewMapCoords) {
    return (
      <div className="pickup-details-shell">
        <div className="pickup-details-map-top">
          <div>
            <span className="pickup-details-kicker">Map view</span>
            <h3 className="pickup-details-map-title">Pickup location</h3>
            <p className="pickup-details-map-copy">
              Review the exact collection point before returning to the pickup details.
            </p>
          </div>
          <ActionButton
            type="button"
            icon="back"
            tone="neutral"
            minWidth={168}
            onClick={() => setViewMapCoords(null)}
          >
            Back to Details
          </ActionButton>
        </div>
        <div className="pickup-details-map-frame">
          <MapPicker
            open={true}
            initial={viewMapCoords}
            onCancel={() => setViewMapCoords(null)}
            readOnly={true}
            embedded={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pickup-details-shell">
      <div className="pickup-details-hero">
        <div className="pickup-details-hero-copy">
          <span className="pickup-details-kicker">
            {role === "ngo" || isAdminViewer ? "Pickup details" : "Pickup overview"}
          </span>
          <h3>{role === "ngo" || isAdminViewer ? "Review the collection request" : "Manage your scheduled pickup"}</h3>
          <p>
            {volunteerName} requested a {pickup.wasteType || "waste"} pickup for {dateString} at {timeString}.
          </p>
        </div>
        <div className="pickup-details-hero-side">
          <span className={`pickup-status-badge pickup-status-${pickup.status || "scheduled"}`}>
            {statusLabel}
          </span>
          <ActionButton
            type="button"
            icon="close"
            tone="neutral"
            size="sm"
            minWidth={126}
            onClick={onClose}
          >
            Close
          </ActionButton>
        </div>
      </div>

      <div className="pickup-details-content-grid">
        <section className="pickup-details-panel-card">
          <div className="pickup-details-panel-head">
            <h4>Pickup summary</h4>
            <p>All scheduled information remains visible in this redesigned view.</p>
          </div>
          <div className="pickup-details-key-grid">
            {pickupSummaryRows.map((row) => (
              <div key={row.label} className="pickup-details-key-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="pickup-details-panel-card pickup-details-location-card">
          <div className="pickup-details-panel-head">
            <h4>Collection location</h4>
            <p>Location, assigned NGO, and agent contact details stay together in one place.</p>
          </div>
          <div className="pickup-details-key-grid pickup-details-location-grid">
            {locationInfoRows.map((row) => (
              <div key={row.label} className="pickup-details-key-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="pickup-details-location-copy">
            <span>{pickup.location?.coordinates ? "Coordinates available for map preview." : "Map coordinates are not available."}</span>
          </div>
          {pickup.location?.coordinates && (
            <ActionButton
              type="button"
              icon="location"
              tone="info"
              minWidth={204}
              onClick={() => setViewMapCoords([pickup.location.coordinates[0], pickup.location.coordinates[1]])}
            >
              See Location in Maps
            </ActionButton>
          )}
        </section>
      </div>

      {pickup.co2Saved > 0 && (
        <div className="pickup-details-impact">
          <span>CO2 Saved</span>
          <strong>{Number(pickup.co2Saved).toFixed(2)} kg</strong>
        </div>
      )}

      <div className="pickup-details-action-bar">
        {!isAdminViewer && pickup.status === "accepted" && (
          <ActionButton
            type="button"
            icon="check"
            tone="primary"
            size="sm"
            minWidth={168}
            onClick={() => setStatusConfirm({ open: true })}
          >
            Update Status
          </ActionButton>
        )}

        {role === "volunteer" && (
          <>
            {pickup.status === "scheduled" && (
              <ActionButton
                type="button"
                icon="edit"
                tone="primary"
                size="sm"
                minWidth={156}
                onClick={() => onEdit(pickup)}
              >
                Edit Pickup
              </ActionButton>
            )}

            {pickup.status === "scheduled" && (
              <ActionButton
                type="button"
                icon="delete"
                tone="danger"
                size="sm"
                minWidth={164}
                onClick={() => setDeleteConfirm({ open: true })}
              >
                Delete Pickup
              </ActionButton>
            )}
          </>
        )}

        {role === "ngo" && pickup.status === "scheduled" && (
          <div className="pickup-claim-shell">
            {!claiming ? (
              <ActionButton
                type="button"
                icon="pickup"
                tone="primary"
                size="sm"
                minWidth={176}
                onClick={() => setClaiming(true)}
              >
                Claim Pickup
              </ActionButton>
            ) : (
              <div className="pickup-claim-form">
                <div className="pickup-details-panel-head">
                  <h4>Assign an agent</h4>
                  <p>Add the collection agent details before confirming this pickup.</p>
                </div>
                <input
                  className={`pickup-claim-input ${claimErrors.name ? "error" : ""}`}
                  placeholder="Agent Name"
                  value={agentName}
                  onChange={(e) => {
                    setAgentName(e.target.value);
                    if (claimErrors.name) {
                      setClaimErrors((current) => ({ ...current, name: false }));
                    }
                  }}
                />
                {claimErrors.name && (
                  <div className="pickup-claim-error">
                    Enter the agent name before claiming the pickup.
                  </div>
                )}
                <input
                  className={`pickup-claim-input ${claimErrors.phone ? "error" : ""}`}
                  placeholder="+91 Enter Mobile Number"
                  value={agentPhone}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  onChange={(e) => {
                    setAgentPhone(digitsOnly(e.target.value));
                    if (claimErrors.phone) {
                      setClaimErrors((current) => ({ ...current, phone: false }));
                    }
                  }}
                />
                {claimErrors.phone && (
                  <div className="pickup-claim-error">
                    Enter a valid 10-digit mobile number before claiming the pickup.
                  </div>
                )}
                <div className="pickup-claim-actions">
                  <ActionButton
                    type="button"
                    icon="close"
                    tone="neutral"
                    size="sm"
                    minWidth={136}
                    onClick={handleClaimCancel}
                  >
                    Cancel
                  </ActionButton>
                  <ActionButton
                    type="button"
                    icon="pickup"
                    tone="primary"
                    size="sm"
                    minWidth={196}
                    onClick={handleConfirmClaim}
                  >
                    Confirm Claim
                  </ActionButton>
                </div>
              </div>
            )}
          </div>
        )}

        {canDownloadPdf && (
          <ActionButton
            type="button"
            icon="download"
            tone="info"
            size="sm"
            minWidth={214}
            onClick={() => onDownloadPdf(pickup)}
          >
            Download PDF Receipt
          </ActionButton>
        )}

        {canReportCounterpart && (
          <ActionButton
            type="button"
            icon="report"
            tone="danger"
            size="sm"
            minWidth={156}
            onClick={() => onReport(pickup)}
          >
            Report User
          </ActionButton>
        )}
      </div>

      <ConfirmDialog
        open={statusConfirm.open}
        message="Update Pickup Status"
        onConfirm={() => { setStatusConfirm({ open: false }); onComplete(pickup._id); }}
        onCancel={() => setStatusConfirm({ open: false })}
        confirmLabel="Pickup Completed"
        cancelLabel="Still Not Completed"
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        message="Are you sure you want to delete this pickup?"
        danger={true}
        buttonType="delete"
        onConfirm={() => { setDeleteConfirm({ open: false }); onDelete(pickup._id); }}
        onCancel={() => setDeleteConfirm({ open: false })}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
};

// ----------------------------------------
// --- 2. PickupList component          ---
// ----------------------------------------
const getTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(dateStr).toLocaleDateString();
};

const PickupList = ({ pickups, onSelect, selectedId }) => {
  if (!pickups || pickups.length === 0) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-disabled)", fontSize: "16px" }}>
        No pickups found.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {pickups.map((item) => {
        const isSelected = selectedId && String(item._id) === String(selectedId);
        return (
          <div
            key={item._id}
            onClick={() => onSelect(item)}
            style={{
              cursor: "pointer",
              padding: "20px",
              border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-color)",
              borderRadius: "12px",
              background: isSelected ? "var(--surface-success-soft)" : "var(--surface-primary)",
              display: "flex",
              flexDirection: "column",
              boxShadow: isSelected ? "var(--shadow-medium)" : "var(--shadow-soft)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-strong)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isSelected ? 'var(--shadow-medium)' : 'var(--shadow-soft)'; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-primary)", marginBottom: "12px", alignItems: "center" }}>
              <span>Scheduled by <strong style={{ color: "var(--text-primary)" }}>{item.userId?.fullName || "Volunteer"}</strong> on <strong>{new Date(item.pickupDate).toLocaleDateString()}</strong></span>
              <span className={`status ${item.status}`} style={{ margin: 0 }}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: "600", color: "var(--text-primary)", fontSize: "15px" }}>
                Waste type: <span style={{ color: "var(--text-primary)" }}>{item.wasteType}</span> <span style={{ fontWeight: "400", color: "var(--text-secondary)", fontSize: "14px", marginLeft: "4px" }}>({item.quantity} kg{item.quantity > 1 ? 's' : ''})</span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-disabled)" }}>
                {getTimeAgo(item.updatedAt || item.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ----------------------------------------
// --- 3. PickupForm component          ---
// ----------------------------------------
const generateDates = () => {
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push({ label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), value: d });
  }
  return dates;
};
const ALL_DATES = generateDates();

const generateTimes = () => {
  const times = [];
  for (let i = 8; i <= 18; i++) {
    times.push(`${i < 10 ? '0' : ''}${i}:00`);
    times.push(`${i < 10 ? '0' : ''}${i}:30`);
  }
  return times;
};
const ALL_TIMES = generateTimes();

const PickupForm = ({ onSubmit, onCancel, initialData, me }) => {
  const [step, setStep] = useState(1);
  const [isLocLoading, setIsLocLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [errorMsg, setErrorMsg] = useState(false);
  const isEditing = Boolean(initialData);

  const [form, setForm] = useState(initialData || {
    wasteType: "",
    quantity: "",
    dateObj: ALL_DATES[0].value,
    timeStr: "09:00",
    city: "",
    village: "",
    street: "",
    phone: digitsOnly(me?.phone || ""),
    lat: null,
    lon: null
  });

  useEffect(() => {
    if (!initialData && me?.location?.coordinates && !form.lat) {
      const [lon, lat] = me.location.coordinates;
      setForm(f => ({ ...f, lat, lon }));
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
        .then(r => r.json())
        .then(data => {
          const addr = data.address || {};
          setForm(f => ({
            ...f,
            city: addr.city || addr.town || addr.county || "",
            village: addr.village || addr.suburb || "",
            street: addr.road || addr.street || ""
          }));
        }).catch(() => { });
    }
  }, [initialData, me, form.lat]);

  const wasteTypes = [
    "Plastic", "Glass", "Paper", "Electronic Waste", "Organic Waste", "Metal", "Other"
  ];

  const handleNextClick = () => {
    if (!form.wasteType || !form.quantity) {
      setErrorMsg(true);
      return;
    }
    setErrorMsg(false);
    setStep(2);
  };

  const handleFinalSubmit = () => {
    const sanitizedPhone = digitsOnly(form.phone);
    if (!form.lat || sanitizedPhone.length !== 10) {
      setErrorMsg(true);
      return;
    }

    setErrorMsg(false);
    const finalDate = new Date(form.dateObj);
    const [hours, mins] = form.timeStr.split(":");
    finalDate.setHours(parseInt(hours, 10), parseInt(mins, 10), 0, 0);

    onSubmit({
      ...form,
      phone: sanitizedPhone,
      pickupDate: finalDate.toISOString()
    });
  };

  const combinedAddress = [form.street, form.village, form.city].filter(Boolean).join(" - ");
  const selectedDateLabel = form.dateObj?.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Form comparison for Edit flow updating
  const formHasChanges = () => {
    if (!initialData) return true;
    return JSON.stringify(form) !== JSON.stringify(initialData);
  };

  if (step === 1) {
    return (
      <div className="step pickup-form-shell">
        <div className="pickup-form-header">
          <div>
            <span className="pickup-form-kicker">Step 1 of 2</span>
            <h3 className="pickup-form-title">What are you scheduling?</h3>
            <p className="pickup-form-copy">
              Select the waste type and quantity so we can match this request with the right recycling support.
            </p>
          </div>
          <div className="pickup-form-progress">
            <span className="pickup-form-progress-step active">Waste</span>
            <span className="pickup-form-progress-step">Location &amp; Time</span>
          </div>
        </div>

        <div className="pickup-form-layout">
          <section className="pickup-form-panel pickup-form-panel-highlight">
            <div className="pickup-form-section-head">
              <h4>Waste type</h4>
              <p>Pick the category that best matches your request.</p>
            </div>
            <div className="waste-options pickup-form-waste-grid">
          {wasteTypes.map((item, index) => {
            const isSelected = form.wasteType === item;
            return (
              <label
                key={index}
                className="waste-card-option"
                style={{
                  background: isSelected ? "var(--primary)" : "var(--surface-primary)",
                  color: isSelected ? "var(--text-inverse)" : "var(--text-primary)",
                  borderColor: isSelected ? "var(--primary)" : "var(--border-color)",
                  fontWeight: isSelected ? "600" : "400"
                }}
              >
                <input
                  type="radio"
                  name="wasteType"
                  checked={isSelected}
                  onChange={() => setForm({ ...form, wasteType: item })}
                />
                <span className="custom-check" style={{ borderColor: isSelected ? "var(--text-inverse)" : "var(--border-color)", background: isSelected ? "var(--text-inverse)" : "transparent" }}></span>
                {item}
              </label>
            );
          })}
            </div>
            {errorMsg && !form.wasteType && <div className="pickup-form-error">Please select waste type.</div>}
          </section>

          <section className="pickup-form-panel">
            <div className="pickup-form-section-head">
              <h4>Quantity</h4>
              <p>Enter the estimated weight. You can schedule between 1 kg and 20 kg.</p>
            </div>
            <label className="pickup-form-label" htmlFor="pickup-quantity">
            Quantity (kg) <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            id="pickup-quantity"
            type="number"
            min="1"
            max="20"
            className="pickup-form-input"
            value={form.quantity}
            onChange={(e) => {
              let val = parseInt(e.target.value, 10);
              if (val > 20) val = 20;
              setForm({ ...form, quantity: isNaN(val) ? "" : val });
            }}
            placeholder="Example: 8"
          />
          {errorMsg && !form.quantity && <div className="pickup-form-error">Please enter quantity.</div>}
          <div className="pickup-form-summary-card">
            <span>Current selection</span>
            <strong>{form.wasteType || "Select a waste type"}</strong>
            <small>{form.quantity ? `${form.quantity} kg ready for pickup` : "Add quantity to continue"}</small>
          </div>
          </section>
        </div>

        <div className="next_step pickup-form-actions">
          {isEditing ? (
            <ActionButton
              type="button"
              icon="close"
              tone="neutral"
              size="sm"
              minWidth={132}
              onClick={onCancel}
            >
              Cancel
            </ActionButton>
          ) : (
            <div style={{ flex: 1 }} aria-hidden="true" />
          )}
          <ActionButton
            type="button"
            icon="arrow-right"
            tone="primary"
            size="sm"
            minWidth={138}
            onClick={handleNextClick}
          >
            Next
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="step pickup-form-shell">
      <div className="pickup-form-header">
        <div>
          <span className="pickup-form-kicker">Step 2 of 2</span>
          <h3 className="pickup-form-title">{isEditing ? "Review and update the pickup" : "Choose the collection details"}</h3>
          <p className="pickup-form-copy">
            Confirm the location, pickup slot, and phone number before you {isEditing ? "save the changes" : "schedule the request"}.
          </p>
        </div>
        <div className="pickup-form-progress">
          <span className="pickup-form-progress-step complete">Waste</span>
          <span className="pickup-form-progress-step active">Location &amp; Time</span>
        </div>
      </div>

      <div className="pickup-form-layout pickup-form-layout-two-column">
        <section className="pickup-form-panel pickup-form-panel-highlight">
          <div className="pickup-form-section-head">
            <h4>Pickup location</h4>
            <p>Use your current location or place the marker manually on the map.</p>
          </div>
          <label className="pickup-form-label">Location <span style={{ color: "var(--danger)" }}>*</span></label>
          <div className="pickup-form-location-actions">
            <ActionButton
              type="button"
              icon="crosshair"
              tone="primary"
              minWidth={196}
              disabled={isLocLoading}
              onClick={() => {
                setIsLocLoading(true);
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                      const data = await res.json();
                      const addr = data && data.address ? data.address : {};
                      setForm(f => ({ ...f, lat: latitude, lon: longitude, city: addr.city || addr.town || addr.county || "", village: addr.village || addr.suburb || "", street: addr.road || addr.street || "" }));
                    } catch (e) {
                      setForm(f => ({ ...f, lat: latitude, lon: longitude }));
                    } finally { setIsLocLoading(false); }
                  },
                  () => { setIsLocLoading(false); }
                );
              }}
            >
              {isLocLoading ? "Loading..." : "Use Current Location"}
            </ActionButton>
            <ActionButton
              type="button"
              icon="map"
              tone="info"
              minWidth={170}
              onClick={() => setShowMap(true)}
            >
              Pick from Map
            </ActionButton>
          </div>
          <div className="pickup-form-address-card">
            <strong>{combinedAddress || "Location will appear here"}</strong>
            <span>{form.lat && form.lon ? `${Number(form.lat).toFixed(5)}, ${Number(form.lon).toFixed(5)}` : "Select a location to continue"}</span>
          </div>
          {errorMsg && !form.lat && <div className="pickup-form-error">Please choose a location.</div>}
        </section>

      <MapPicker
        open={showMap}
        initial={form.lat && form.lon ? [form.lat, form.lon] : null}
        onCancel={() => setShowMap(false)}
        onChoose={(res) => {
          setForm(f => ({ ...f, lat: res.lat, lon: res.lon, city: res.city || "", village: "", street: "" }));
          setShowMap(false);
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${res.lat}&lon=${res.lon}`)
            .then(r => r.json())
            .then(data => {
              const addr = data.address || {};
              setForm(f => ({
                ...f,
                city: addr.city || addr.town || addr.county || "",
                village: addr.village || addr.suburb || "",
                street: addr.road || addr.street || ""
              }));
            }).catch(e => { });
        }}
      />

      <section className="pickup-form-panel">
        <div className="pickup-form-section-head">
          <h4>Time slot</h4>
          <p>Choose the day and time when you will be available for handoff.</p>
        </div>
        <label className="pickup-form-label">Schedule time <span style={{ color: "var(--danger)" }}>*</span></label>
        <div className="pickup-form-wheel-grid">
          <div style={{ flex: 1 }}>
            <div className="pickup-form-wheel-title">DATE</div>
            <WheelPicker
              options={ALL_DATES}
              value={form.dateObj}
              onChange={(opt) => setForm(f => ({ ...f, dateObj: opt.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="pickup-form-wheel-title">TIME</div>
            <WheelPicker
              options={ALL_TIMES}
              value={form.timeStr}
              onChange={(opt) => setForm(f => ({ ...f, timeStr: opt }))}
            />
          </div>
        </div>
        <div className="pickup-form-tip">
          Note: Please make sure you are available at the pickup time.
        </div>
      </section>

      </div>

      <div className="pickup-form-layout pickup-form-layout-two-column pickup-form-layout-bottom">
        <section className="pickup-form-panel">
          <div className="pickup-form-section-head">
            <h4>Contact number</h4>
            <p>This number helps the assigned team coordinate the pickup smoothly.</p>
          </div>
          <label className="pickup-form-label" htmlFor="pickup-phone">
          Phone Number <span style={{ color: "var(--danger)" }}>*</span>
        </label>
        <input
          id="pickup-phone"
          type="tel"
          className="pickup-form-input"
          value={form.phone}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          onChange={(e) => setForm({ ...form, phone: digitsOnly(e.target.value) })}
          placeholder="+91 Enter Mobile Number"
        />
          {errorMsg && form.phone.length !== 10 && <div className="pickup-form-error">Please enter a valid 10-digit mobile number.</div>}
        </section>

        <section className="pickup-form-panel pickup-form-summary-panel">
          <div className="pickup-form-section-head">
            <h4>Pickup summary</h4>
            <p>Review the request before you confirm it.</p>
          </div>
          <div className="pickup-form-summary-card pickup-form-summary-card-strong">
            <span>{form.wasteType || "Waste type pending"}</span>
            <strong>{form.quantity ? `${form.quantity} kg scheduled` : "Quantity pending"}</strong>
            <small>{selectedDateLabel || "Choose a date"} at {form.timeStr}</small>
          </div>
          <div className="pickup-form-summary-card">
            <span>Pickup address</span>
            <strong>{combinedAddress || "Location pending"}</strong>
            <small>{form.phone || "Add a contact number"}</small>
          </div>
        </section>
      </div>

      <div className="next_step pickup-form-actions">
        {isEditing ? (
          <>
            <ActionButton
              type="button"
              icon="close"
              tone="neutral"
              size="sm"
              minWidth={132}
              onClick={onCancel}
            >
              Cancel
            </ActionButton>
            <ActionButton
              type="button"
              icon="save"
              tone="primary"
              minWidth={176}
              disabled={!form.lat || form.phone.length !== 10 || !formHasChanges()}
              onClick={handleFinalSubmit}
            >
              Update Pickup
            </ActionButton>
          </>
        ) : (
          <>
            <ActionButton
              type="button"
              icon="back"
              tone="neutral"
              size="sm"
              minWidth={138}
              onClick={() => setStep(1)}
            >
              Previous
            </ActionButton>
            <ActionButton
              type="button"
              icon="pickup"
              tone="primary"
              minWidth={184}
              disabled={!form.lat || form.phone.length !== 10}
              onClick={handleFinalSubmit}
            >
              Schedule Pickup
            </ActionButton>
          </>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------
// --- 4. Main Page Component           ---
// ----------------------------------------
export default function SchedulePickup() {
  const { data: me } = useMe();
  const role = me?.role || "volunteer";
  const navigate = useNavigate();
  const location = useLocation();
  const isVolunteer = role === "volunteer";
  const isNgo = role === "ngo";
  const isAdmin = role === "admin";

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(role === "ngo" ? "pickup" : role === "admin" ? "history" : "new");

  const [msgBox, setMsgBox] = useState({ open: false, type: "info", message: "", closing: false });
  const [selectedPickup, setSelectedPickup] = useState(null);
  const [editingPickup, setEditingPickup] = useState(null);
  const [celebDialog, setCelebDialog] = useState({ open: false, co2Saved: 0 });

  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  const [pickupReportDialog, setPickupReportDialog] = useState({
    open: false,
    pickup: null,
    reason: "",
    reasonError: false,
  });
  const [pickupReportSubmitting, setPickupReportSubmitting] = useState(false);
  const [pickupReportSuccessOpen, setPickupReportSuccessOpen] = useState(false);

  const pageScrollRef = useRef(null);
  const scrollFrameRef = useRef(null);

  const showMessage = (message, type = "info", duration = 3200) => {
    setMsgBox({ open: true, type, message, closing: false });

    window.setTimeout(() => {
      setMsgBox((current) => ({ ...current, closing: true }));
      window.setTimeout(() => {
        setMsgBox({ open: false, type: "info", message: "", closing: false });
      }, 300);
    }, duration);
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false });
  };

  const openRestrictionDialog = (message) => {
    setConfirmDialog({
      open: true,
      message,
      buttonType: "warning",
      confirmLabel: "OK",
      cancelLabel: "Close",
      onConfirm: closeConfirmDialog,
      onCancel: closeConfirmDialog,
    });
  };

  const closePickupReportDialog = () => {
    setPickupReportDialog({
      open: false,
      pickup: null,
      reason: "",
      reasonError: false,
    });
  };

  const openPickupReportDialog = (pickup) => {
    setPickupReportDialog({
      open: true,
      pickup,
      reason: "",
      reasonError: false,
    });
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

  const scrollToPageTop = (behavior = "smooth") => {
    if (scrollFrameRef.current) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const pageNode = pageScrollRef.current;
      if (pageNode && typeof pageNode.scrollTo === "function") {
        pageNode.scrollTo({ top: 0, behavior });
        return;
      }

      window.scrollTo({ top: 0, behavior });
    });
  };

  useEffect(() => {
    if (isAdmin && activeTab !== "history") {
      setActiveTab("history");
      return;
    }

    if (isNgo && activeTab === "new") {
      setActiveTab("pickup");
    }
  }, [activeTab, isAdmin, isNgo]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const { data: pickups, isLoading } = useQuery({
    queryKey: ["pickups"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/pickup`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pickups");
      return res.json();
    },
    staleTime: Infinity,
    enabled: !!me
  });

  // Handle URL params: ?tab=history&pickupId=xxx&celebrate=1
  // (Used when navigating from a notification click)
  const handledUrlRef = useRef(false);
  useEffect(() => {
    if (!me || !pickups || handledUrlRef.current) return;
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const pickupId = params.get('pickupId');
    const celebrate = params.get('celebrate');
    if (!tab && !pickupId) return;
    handledUrlRef.current = true;

    if (tab === 'history') {
      setActiveTab("history");
    } else if (tab === "pickup" && isNgo) {
      setActiveTab("pickup");
    }
    if (pickupId) {
      const target = pickups.find(p => String(p._id) === String(pickupId));
      if (target) {
        setSelectedPickup(target);
        scrollToPageTop("auto");
        if (celebrate === '1') {
          setTimeout(() => setCelebDialog({ open: true, co2Saved: target.co2Saved || 0 }), 400);
        }
      }
    }
    // Clean URL so it doesn't re-trigger
    navigate('/home/schedule', { replace: true });
  }, [me, pickups, location.search, navigate, isNgo]);

  const handleTemplateSelection = (item, options = {}) => {
    setConfirmDialog({ open: false });
    setSelectedPickup(item);
    if (item && options.scroll !== false) {
      scrollToPageTop(options.behavior || "smooth");
    }
  };

  // Sync selectedPickup with global cache
  useEffect(() => {
    if (pickups && selectedPickup) {
      const updated = pickups.find(p => String(p._id) === String(selectedPickup._id));
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedPickup)) {
        setSelectedPickup(updated);
      } else if (!updated) {
        setSelectedPickup(null);
      }
    }
  }, [pickups, selectedPickup]);

  // Sync editingPickup with global cache
  useEffect(() => {
    if (pickups && editingPickup) {
      const updated = pickups.find(p => String(p._id) === String(editingPickup._id));
      if (updated && JSON.stringify(updated) !== JSON.stringify(editingPickup)) {
        setEditingPickup(updated);
      } else if (!updated) {
        setEditingPickup(null);
      }
    }
  }, [pickups, editingPickup]);

  const createMut = useMutation({
    mutationFn: async (form) => {
      const res = await fetch(`${API_BASE}/pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(payload.message || "Failed to create");
        error.restrictedUntil = payload.restrictedUntil;
        throw error;
      }
      return payload;
    },
    onSuccess: (data) => {
      setActiveTab("history");
      setSelectedPickup(data.pickup);
      scrollToPageTop();
      setConfirmDialog({
        open: true,
        title: "Scheduled",
        message: "Your pickup is scheduled",
        confirmLabel: "Done",
        hideCancel: true,
        buttonType: "pickup",
        onConfirm: closeConfirmDialog,
        onCancel: closeConfirmDialog
      });
    },
    onError: (error) => {
      if (error?.restrictedUntil) {
        openRestrictionDialog(
          error.message ||
            buildRestrictionDialogMessage(
              error.restrictedUntil,
              "scheduling pickups"
            )
        );
        return;
      }

      showMessage(error?.message || "Failed to schedule pickup.", "error");
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, form }) => {
      const res = await fetch(`${API_BASE}/pickup/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (data) => {
      setEditingPickup(null);
      setSelectedPickup(data.pickup);
      scrollToPageTop();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${API_BASE}/pickup/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || "Failed to delete");
      }
      return payload;
    },
    onSuccess: (data) => {
      setSelectedPickup(null);
      showMessage(data?.message || "Pickup deleted successfully.", "success");
    },
    onError: (error) => {
      showMessage(error?.message || "Failed to delete pickup.", "error");
    },
  });

  const acceptMut = useMutation({
    mutationFn: async ({ id, agent }) => {
      const res = await fetch(`${API_BASE}/pickup/${id}/accept`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agent })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(payload.message || "Failed to accept");
        error.restrictedUntil = payload.restrictedUntil;
        throw error;
      }
      return payload;
    },
    onSuccess: (data) => {
      setSelectedPickup(data.pickup);
      setConfirmDialog({
        open: true,
        title: "Claimed",
        message: "Pickup claimed successfully",
        confirmLabel: "Go to History",
        cancelLabel: "Close",
        buttonType: "pickup",
        onConfirm: () => { setConfirmDialog({ open: false }); setActiveTab("history"); },
        onCancel: () => setConfirmDialog({ open: false })
      });
    },
    onError: (error) => {
      if (error?.restrictedUntil) {
        openRestrictionDialog(
          error.message ||
            buildRestrictionDialogMessage(
              error.restrictedUntil,
              "claiming pickups"
            )
        );
        return;
      }

      showMessage(error?.message || "Failed to claim pickup.", "error");
    },
  });

  const completeMut = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${API_BASE}/pickup/${id}/complete`, {
        method: "PUT",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to complete");
      return res.json();
    },
    onSuccess: (data) => {
      setSelectedPickup(data.pickup);

      queryClient.setQueryData(["dashboard"], (old) => {
        if (!old) return old;
        return {
          ...old,
          co2Saved: (old.co2Saved || 0) + (data.pickup.co2Saved || 0),
          completedCount: (old.completedCount || 0) + 1
        };
      });

      queryClient.setQueryData(["pickups"], (old) => {
        if (!old) return old;
        return old.map(p =>
          p._id === data.pickup._id ? { ...p, status: "completed", co2Saved: data.pickup.co2Saved } : p
        );
      });

      // Show local celebration dialog
      setCelebDialog({ open: true, co2Saved: data.pickup.co2Saved || 0 });
    },
  });

  const handleCreatePickup = (form) => {
    const restrictedUntil = getActiveRestrictionUntil();
    if (restrictedUntil) {
      openRestrictionDialog(
        buildRestrictionDialogMessage(restrictedUntil, "scheduling pickups")
      );
      return;
    }

    createMut.mutate(form);
  };

  const handleClaimPickup = ({ id, agent }) => {
    const restrictedUntil = getActiveRestrictionUntil();
    if (restrictedUntil) {
      openRestrictionDialog(
        buildRestrictionDialogMessage(restrictedUntil, "claiming pickups")
      );
      return;
    }

    acceptMut.mutate({ id, agent });
  };

  const handleSubmitPickupReport = async () => {
    const pickupId = pickupReportDialog.pickup?._id;
    const trimmedReason = String(pickupReportDialog.reason || "").trim();

    if (!pickupId) {
      return;
    }

    if (!trimmedReason) {
      setPickupReportDialog((current) => ({
        ...current,
        reasonError: true,
      }));
      return;
    }

    setPickupReportSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/pickup/${pickupId}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmedReason }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.message || "Failed to submit report");
      }

      closePickupReportDialog();
      setPickupReportSuccessOpen(true);
    } catch (error) {
      showMessage(error?.message || "Failed to submit report.", "error");
    } finally {
      setPickupReportSubmitting(false);
    }
  };

  const displayedPickups = React.useMemo(() => {
    if (!pickups) return [];
    if (role === "admin") {
      return pickups;
    }
    if (role === "ngo") {
      if (activeTab === "pickup") return pickups.filter(p => !p.ngoId);
      return pickups.filter(p => p.ngoId && String(p.ngoId._id) === String(me?.id || me?._id));
    } else {
      return pickups;
    }
  }, [pickups, role, activeTab, me]);

  const handleDownloadPdf = async (pickupObj) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 14;
    const right = pageWidth - 14;
    const contentWidth = right - left;
    const coordinates = pickupObj?.location?.coordinates || [];
    const lat = coordinates[0];
    const lon = coordinates[1];
    const address = buildPickupAddress(pickupObj);
    const mapUrl =
      lat != null && lon != null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
        : "";

    const writeKeyValue = (label, value, y) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(28, 41, 58);
      doc.text(`${label}`, left + 4, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value || "N/A"), left + 48, y, { maxWidth: contentWidth - 56 });
      return y + 7;
    };

    const drawSection = (title, rows, startY) => {
      doc.setFillColor(35, 134, 122);
      doc.roundedRect(left, startY, contentWidth, 10, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(title, left + 4, startY + 6.5);

      doc.setDrawColor(219, 229, 235);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(left, startY + 12, contentWidth, rows.length * 7 + 10, 4, 4, "FD");

      let y = startY + 19;
      rows.forEach(([label, value]) => {
        y = writeKeyValue(label, value, y);
      });
      return startY + rows.length * 7 + 26;
    };

    let recycleIcon = null;
    try {
      recycleIcon = await getRecyclePdfIcon();
    } catch (error) { }

    doc.setFillColor(7, 177, 123);
    doc.rect(0, 0, pageWidth, 28, "F");
    if (recycleIcon) {
      doc.addImage(recycleIcon, "PNG", left, 6, 12, 12);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text("Waste Pickup Receipt", recycleIcon ? left + 16 : left, 17);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, recycleIcon ? left + 16 : left, 23);

    let y = 38;
    y = drawSection("Pickup Details", [
      ["Receipt ID", pickupObj?._id || "N/A"],
      ["Status", pickupObj?.status || "N/A"],
      ["Waste Type", pickupObj?.wasteType || "N/A"],
      ["Quantity", pickupObj?.quantity != null ? `${pickupObj.quantity} kg` : "N/A"],
      ["Pickup Date", pickupObj?.pickupDate ? new Date(pickupObj.pickupDate).toLocaleString("en-IN") : "N/A"],
      ["Address", address],
    ], y);

    y = drawSection("Volunteer Details", [
      ["Name", pickupObj?.userId?.fullName || "N/A"],
      ["Email", pickupObj?.userId?.email || "N/A"],
      ["Phone", pickupObj?.phone || pickupObj?.userId?.phone || "N/A"],
    ], y);

    y = drawSection("NGO Details", [
      ["Name", pickupObj?.ngoId?.fullName || "N/A"],
      ["Email", pickupObj?.ngoId?.email || "N/A"],
      ["Phone", pickupObj?.ngoId?.phone || "N/A"],
    ], y);

    y = drawSection("Agent Details", [
      ["Agent Name", pickupObj?.agent?.name || "N/A"],
      ["Agent Phone", pickupObj?.agent?.phone || "N/A"],
    ], y);

    if (mapUrl) {
      doc.setFillColor(240, 253, 250);
      doc.setDrawColor(148, 163, 184);
      doc.roundedRect(left, y, contentWidth, 24, 4, 4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(28, 41, 58);
      doc.text("Location Link", left + 4, y + 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Coordinates: ${lat}, ${lon}`, left + 4, y + 15);
      doc.setTextColor(0, 102, 204);
      doc.textWithLink("Click to view location on Google Maps", left + 4, y + 21, { url: mapUrl });
    }

    doc.save(`pickup-receipt-${pickupObj?._id || "receipt"}.pdf`);
  };

  return (
    <div className="page" style={{ position: "relative" }} ref={pageScrollRef}>
      {(isLoading || createMut.isPending || updateMut.isPending || acceptMut.isPending || completeMut.isPending || deleteMut.isPending || pickupReportSubmitting) && <Loading isLoading={true} />}

      <div className="page-header-wrapper left" style={{ scrollMarginTop: "100px" }}>
        <h2 className="page-header">{isNgo ? "Pickup Dashboard" : isAdmin ? "Schedule Pickups" : "Request Waste Collection"}</h2>
        <p className="page-subtitle">{isNgo ? "Manage and claim waste assignments." : isAdmin ? "Review every pickup request and open full details in read-only mode." : "Request waste collection and manage your pickups."}</p>
      </div>

      <div className="Schedule-card" style={{ marginTop: "32px" }}>
        <div className="Schedule-optins" style={{ borderBottomColor: "var(--primary)" }}>
          {isVolunteer && (
            <div className={activeTab === "new" ? "active-tab" : ""} style={{ borderColor: activeTab === "new" ? "var(--primary)" : "transparent", color: activeTab === "new" ? "var(--primary)" : "var(--text-secondary)" }} onClick={() => { setActiveTab("new"); setEditingPickup(null); handleTemplateSelection(null, { scroll: false }); }}>
              Schedule New Pickup
            </div>
          )}
          <div className={activeTab === "pickup" && isNgo ? "active-tab" : ""} style={{ display: isNgo ? "block" : "none", borderColor: activeTab === "pickup" ? "var(--primary)" : "transparent", color: activeTab === "pickup" ? "var(--primary)" : "var(--text-secondary)" }} onClick={() => { setActiveTab("pickup"); setEditingPickup(null); handleTemplateSelection(null, { scroll: false }); }}>
            Pickup
          </div>
          <div className={activeTab === "history" ? "active-tab" : ""} style={{ borderColor: activeTab === "history" ? "var(--primary)" : "transparent", color: activeTab === "history" ? "var(--primary)" : "var(--text-secondary)" }} onClick={() => { setActiveTab("history"); setEditingPickup(null); handleTemplateSelection(null, { scroll: false }); }}>
            {isAdmin ? "All Pickups" : "History"}
          </div>
        </div>

        <div className="tab-content" style={{ padding: "32px 0" }}>

          {activeTab === "new" && isVolunteer && !editingPickup && (
            <div className="fade-content">
              <PickupForm onSubmit={handleCreatePickup} me={me} />
            </div>
          )}

          {editingPickup && (
            <div className="fade-content" style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
                <h3 style={{ margin: 0, color: "var(--primary)", fontWeight: "bold", fontSize: "22px" }}>Edit Pickup</h3>
                <button onClick={() => setEditingPickup(null)} style={{ background: "none", border: "none", fontSize: "32px", cursor: "pointer", color: "var(--primary)", padding: 0, lineHeight: 1 }}>&times;</button>
              </div>
              <PickupForm
                initialData={{
                  wasteType: editingPickup.wasteType,
                  quantity: editingPickup.quantity,
                  dateObj: new Date(editingPickup.pickupDate),
                  timeStr: `${new Date(editingPickup.pickupDate).getHours().toString().padStart(2, '0')}:${new Date(editingPickup.pickupDate).getMinutes().toString().padStart(2, '0')}`,
                  city: editingPickup.address?.city || "",
                  village: editingPickup.address?.village || "",
                  street: editingPickup.address?.street || "",
                  phone: digitsOnly(editingPickup.phone || ""),
                  lat: editingPickup.location?.coordinates?.[0] || null,
                  lon: editingPickup.location?.coordinates?.[1] || null
                }}
                onSubmit={(form) => updateMut.mutate({ id: editingPickup._id, form })}
                onCancel={() => setEditingPickup(null)}
                me={me}
              />
            </div>
          )}

          {!editingPickup && (
            <div
              style={{
                height: selectedPickup ? "auto" : 0,
                overflow: "hidden",
                transition: "all 0.4s ease-in-out",
                opacity: selectedPickup ? 1 : 0,
                transform: selectedPickup ? "translateY(0)" : "translateY(-10px)"
              }}
            >
              <PickupDetailsInline
                key={selectedPickup ? selectedPickup._id : "empty"}
                pickup={selectedPickup}
                role={role}
                me={me}
                onClose={() => setSelectedPickup(null)}
                onClaim={(id, agent) => handleClaimPickup({ id, agent })}
                onComplete={(id) => completeMut.mutate(id)}
                onEdit={(p) => setEditingPickup(p)}
                onDelete={(id) => deleteMut.mutate(id)}
                onDownloadPdf={handleDownloadPdf}
                onReport={openPickupReportDialog}
              />
            </div>
          )}

          {(activeTab === "history" || activeTab === "pickup") && !editingPickup && (
            <div className="fade-content">
              <h3 style={{ marginBottom: "20px", color: "var(--text-primary)", fontSize: "20px" }}>
                {isNgo
                  ? (activeTab === "pickup" ? "All Global Pickups" : "My Claimed Pickups")
                  : isAdmin
                    ? "All Pickups"
                    : "Pickup History"}
              </h3>
              <PickupList pickups={displayedPickups} onSelect={handleTemplateSelection} selectedId={selectedPickup?._id} />
            </div>
          )}
        </div>
      </div>

      {pickupReportDialog.open && (
        <div
          onClick={closePickupReportDialog}
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay-scrim)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9998,
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: "var(--surface-primary)",
              borderRadius: "24px",
              boxShadow: "var(--shadow-strong)",
              overflow: "hidden",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "18px",
                padding: "24px 26px 18px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "24px", fontWeight: 800 }}>
                  Report User
                </h3>
                <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
                  Select the reason for reporting this accepted pickup to admin.
                </p>
              </div>
              <ActionButton
                type="button"
                icon="close"
                tone="neutral"
                size="sm"
                minWidth={124}
                onClick={closePickupReportDialog}
                disabled={pickupReportSubmitting}
              >
                Close
              </ActionButton>
            </div>

            <div style={{ display: "grid", gap: "14px", padding: "24px 26px 10px" }}>
              <label
                htmlFor="pickup-report-reason"
                style={{
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                Reason
              </label>
              <select
                id="pickup-report-reason"
                value={pickupReportDialog.reason}
                disabled={pickupReportSubmitting}
                onChange={(e) =>
                  setPickupReportDialog((current) => ({
                    ...current,
                    reason: e.target.value,
                    reasonError: false,
                  }))
                }
                style={{
                  width: "100%",
                  border: pickupReportDialog.reasonError ? "1px solid var(--danger)" : "1px solid var(--border-color)",
                  borderRadius: "14px",
                  padding: "13px 15px",
                  fontSize: "15px",
                  color: "var(--text-primary)",
                  background: "var(--surface-primary)",
                  outline: "none",
                  boxShadow: pickupReportDialog.reasonError ? "0 0 0 4px rgba(220, 38, 38, 0.08)" : "none",
                }}
              >
                <option value="">Select a reason</option>
                {PICKUP_REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                flexWrap: "wrap",
                padding: "18px 26px 26px",
              }}
            >
              <ActionButton
                type="button"
                icon="report"
                tone="danger"
                minWidth={170}
                onClick={handleSubmitPickupReport}
                disabled={pickupReportSubmitting}
              >
                {pickupReportSubmitting ? "Submitting..." : "Report User"}
              </ActionButton>
              <ActionButton
                type="button"
                icon="close"
                tone="neutral"
                minWidth={144}
                onClick={closePickupReportDialog}
                disabled={pickupReportSubmitting}
              >
                Close
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        confirming={confirmDialog.confirming}
        danger={confirmDialog.danger}
        hideCancel={confirmDialog.hideCancel}
        buttonType={confirmDialog.buttonType}
      />

      <CongratulationsDialog
        open={celebDialog.open}
        co2Saved={celebDialog.co2Saved}
        onClose={() => setCelebDialog({ open: false, co2Saved: 0 })}
        onGoToStats={() => { setCelebDialog({ open: false, co2Saved: 0 }); navigate("/home/impact#pickup_chart"); }}
      />

      <ConfirmDialog
        open={pickupReportSuccessOpen}
        title="Reported"
        message="Thank you for reporting. Our admin team will review this issue."
        onConfirm={() => setPickupReportSuccessOpen(false)}
        onCancel={() => setPickupReportSuccessOpen(false)}
        confirmLabel="Close"
        hideCancel={true}
        buttonType="report"
      />

      {msgBox.open && (
        <MessageBox message={msgBox.message} type={msgBox.type} closing={msgBox.closing} />
      )}
    </div>
  );
}

