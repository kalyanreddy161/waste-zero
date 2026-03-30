import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useIsMobile from "../Services/useIsMobile";
import "../styles/MobileNav.css";

const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const MobileDrawer = ({
  open,
  onClose,
  me,
  currentPageLabel,
  customLinks = [],
  customPageKey = "",
  activeCustomKey = "",
  secondaryLinks = [],
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMobile) return;
    const scriptSrc = "https://cdn.lordicon.com/lordicon.js";
    if (!document.querySelector(`script[src=\"${scriptSrc}\"]`)) {
      const script = document.createElement("script");
      script.src = scriptSrc;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [isMobile]);

  if (!isMobile) return null;

  return (
    <>
      <div className={`mobile-drawer ${open ? "open" : ""}`}>
        <div className="mobile-drawer-header">
          <button className="mobile-back-btn" onClick={onClose} aria-label="Close menu">
            <BackIcon />
          </button>
          <div className="mobile-drawer-title">
            <lord-icon
              src="https://cdn.lordicon.com/zruuduya.json"
              trigger="hover"
              colors={`primary:#121331,secondary:#08C18A`}
              style={{ width: 40, height: 40 }}
            ></lord-icon>
            <div>
              <div className="drawer-app-title">WasteZero</div>
              <div className="drawer-user-role">{(me?.role || "guest").toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div className="drawer-user">
          <div className="drawer-user-name">{me?.fullName || "Guest user"}</div>
        </div>

        {currentPageLabel && (
          <div className="drawer-section">
            <p className="drawer-section-label">Now viewing</p>
            <div className="drawer-current">{currentPageLabel}</div>
          </div>
        )}

        {customLinks.length > 0 && (
          <div className="drawer-section">
            <p className="drawer-section-label">Custom links</p>
            <div className="drawer-chip-grid">
              {customLinks.map((link) => (
                <button
                  key={link.key}
                  className={`drawer-chip ${activeCustomKey === link.key ? "active" : ""}`}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("mobile:custom-link", { detail: { page: customPageKey, key: link.key } })
                    );
                    onClose?.();
                  }}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {secondaryLinks.length > 0 && (
          <div className="drawer-section">
            <p className="drawer-section-label">More navigation</p>
            <div className="drawer-link-stack">
              {secondaryLinks.map((link) => (
                <button
                  key={link.to}
                  className="drawer-nav-btn"
                  onClick={() => {
                    navigate(link.to);
                    onClose?.();
                  }}
                >
                  {link.icon && <img src={link.icon} alt="" />}
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={`mobile-drawer-scrim ${open ? "open" : ""}`} onClick={onClose} />
    </>
  );
};

export default MobileDrawer;
