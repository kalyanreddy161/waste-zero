import React from "react";
import ActionButton, { ActionGlyph } from "./ActionButton";
import useDialogTransition from "./useDialogTransition";

const getDialogConfig = (buttonType, danger, title, message, confirmLabel) => {
  const combinedText = `${title} ${message} ${confirmLabel}`.toLowerCase();

  if (
    buttonType === "delete" ||
    combinedText.includes("delete") ||
    combinedText.includes("remove") ||
    combinedText.includes("withdraw")
  ) {
    return { icon: "delete", tone: "danger", badgeBg: "rgba(230, 34, 34, 0.14)", badgeColor: "var(--danger)" };
  }

  if (buttonType === "report" || combinedText.includes("report")) {
    return { icon: "report", tone: "warning", badgeBg: "rgba(245, 158, 11, 0.16)", badgeColor: "var(--warning)" };
  }

  if (buttonType === "apply" || combinedText.includes("apply")) {
    return { icon: "apply", tone: "primary", badgeBg: "rgba(8, 193, 138, 0.14)", badgeColor: "var(--primary)" };
  }

  if (
    buttonType === "pickup" ||
    combinedText.includes("pickup") ||
    combinedText.includes("schedule") ||
    combinedText.includes("scheduled") ||
    combinedText.includes("claim") ||
    combinedText.includes("complete")
  ) {
    return { icon: "pickup", tone: "primary", badgeBg: "var(--primary)", badgeColor: "#ffffff" };
  }

  if (
    buttonType === "warning" ||
    danger ||
    combinedText.includes("restrict") ||
    combinedText.includes("suspend") ||
    combinedText.includes("warning")
  ) {
    return { icon: "suspend", tone: "warning", badgeBg: "rgba(245, 158, 11, 0.16)", badgeColor: "var(--warning)" };
  }

  return { icon: "check", tone: "primary", badgeBg: "rgba(8, 193, 138, 0.14)", badgeColor: "var(--primary)" };
};

export default function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  title = "Confirm",
  confirmLabel = "Yes",
  cancelLabel = "No",
  confirming = false,
  danger = false,
  hideCancel = false,
  buttonType = "default",
}) {
  const { isMounted, isVisible } = useDialogTransition(open, 220);

  if (!isMounted) {
    return null;
  }

  const dialogConfig = getDialogConfig(buttonType, danger, title, message, confirmLabel);
  const canDismiss = !confirming;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (canDismiss) {
          onCancel?.();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        backgroundColor: "var(--overlay-scrim)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 220ms ease",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "linear-gradient(180deg, var(--surface-primary), var(--surface-secondary))",
          borderRadius: "28px",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-strong)",
          overflow: "hidden",
          transform: isVisible ? "scale(1)" : "scale(0)",
          opacity: isVisible ? 1 : 0,
          transition: "transform 220ms cubic-bezier(.2,.85,.32,1.1), opacity 220ms ease",
        }}
      >
        <div
          style={{
            padding: "28px 28px 24px",
            display: "grid",
            gap: "22px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "16px", alignItems: "center", flex: "1 1 260px" }}>
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "22px",
                  display: "grid",
                  placeItems: "center",
                  background: dialogConfig.badgeBg,
                  color: dialogConfig.badgeColor,
                  border: `1px solid ${dialogConfig.badgeColor}33`,
                }}
              >
                <ActionGlyph icon={dialogConfig.icon} />
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--text-secondary)",
                    fontWeight: 700,
                  }}
                >
                  WasteZero confirmation
                </span>
                <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>
                  {title}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "18px 20px",
              borderRadius: "20px",
              border: "1px solid var(--border-color)",
              background: "var(--surface-primary)",
              color: "var(--text-secondary)",
              lineHeight: 1.75,
              fontSize: "15px",
            }}
          >
            {message}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {!hideCancel && (
              <ActionButton
                type="button"
                icon="back"
                tone="neutral"
                minWidth={160}
                onClick={onCancel}
                disabled={!canDismiss}
              >
                {cancelLabel}
              </ActionButton>
            )}
            <ActionButton
              type="button"
              icon={dialogConfig.icon}
              tone={danger ? "danger" : dialogConfig.tone}
              minWidth={180}
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming ? `${confirmLabel}...` : confirmLabel}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
