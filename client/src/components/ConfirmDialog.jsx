import React from "react";

export default function ConfirmDialog({ open, message, onConfirm, onCancel, confirmLabel = "Yes", cancelLabel = "No", confirming = false, danger = false }) {
  if (!open) return null;

  return (
    <div className="opps-create-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="opps-create-modal" style={{ maxWidth: 480, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div className="opps-create-header" style={{ position: "static", justifyContent: "center" }}>
          <h3 style={{ margin: 0, width: "100%" }}>Confirm</h3>
        </div>
        <div style={{ padding: 24 }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#4a5568" }}>{message}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 32 }}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onCancel}
              disabled={confirming}
              style={{ minWidth: 120, padding: '12px 24px' }}
            >
              {cancelLabel}
            </button>
            <button
              className={danger ? "btn details-delete-btn" : "btn btn-primary"}
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              style={{
                minWidth: 120,
                padding: '12px 24px',
                ...(danger ? { background: '#ff3b30', border: 'none', color: '#fff' } : {})
              }}
            >
              {confirming ? (confirmLabel + "...") : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
