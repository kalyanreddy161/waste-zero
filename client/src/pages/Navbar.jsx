import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLoading } from "../Services/LoadingContext";
import { useMe, API_BASE } from "../Services/useMe";
import { useQueryClient } from "@tanstack/react-query";
import { DARK_THEME, resolveThemePreference } from "../Services/theme";
import "../styles/Navbar.css";

// ✅ Import SVG icons
import dashboardIcon from "../assets/icons/dashboard.svg";
import scheduleIcon from "../assets/icons/schedule.svg";
import opportunitiesIcon from "../assets/icons/opportunities.svg";
import messagesIcon from "../assets/icons/messages.svg";
import reportsIcon from "../assets/icons/Reports.svg";
import impactIcon from "../assets/icons/impact.svg";
import profileIcon from "../assets/icons/profile.svg";
import settingsIcon from "../assets/icons/settings.svg";
import logoutIcon from "../assets/icons/logout.svg";
import helpIcon from "../assets/icons/help.svg";
import adminIcon from "../assets/icons/admin.svg";

const API = `${API_BASE}/auth`;

const BanIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M8.5 8.5l7 7"></path>
  </svg>
);

const Navbar = ({ setActivePage }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setLoading } = useLoading();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState(() => resolveThemePreference());
  const isAdmin = me?.role === "admin";
  const isDarkTheme = theme === DARK_THEME;
  const isRestricted = Boolean(
    me?.restrictedUntil &&
    !Number.isNaN(new Date(me.restrictedUntil).getTime()) &&
    new Date(me.restrictedUntil) > new Date()
  );

  // refs for each nav link so we can position the sliding indicator
  const linkRefs = useRef({});
  const sidebarRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, visible: false });

  // 🔐 check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/home`, {
          credentials: "include",
          cache: "no-store"
        });
        if (!res.ok) navigate("/");
      } catch {
        navigate("/");
      }
    };
    checkAuth();
  }, [navigate]);

  // ensure lordicon script
  useEffect(() => {
    const scriptSrc = "https://cdn.lordicon.com/lordicon.js";
    if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
      const script = document.createElement("script");
      script.src = scriptSrc;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const syncTheme = (event) => {
      if (event?.detail?.theme) {
        setTheme(event.detail.theme);
        return;
      }

      setTheme(document.documentElement.classList.contains("dark") ? DARK_THEME : "light");
    };

    syncTheme();
    window.addEventListener("themechange", syncTheme);

    return () => {
      window.removeEventListener("themechange", syncTheme);
    };
  }, []);

  // 🚪 logout
  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch(`${API}/logout`, {
        method: "POST",
        credentials: "include",
      });
      // Clear all cached data on logout to prevent stale state for next user
      queryClient.clear();
    } catch { }
    finally {
      setLoading(false);
    }

    navigate("/");
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // ✅ link with icon
  const link = (text, to, icon) => {
    const active = isActive(to);

    return (
      <button
        className={`nav-link ${active ? "active" : ""}`}
        onClick={() => navigate(to)}
        ref={(el) => (linkRefs.current[to] = el)}
      >
        <img src={icon} alt="" className="nav-icon" />
        {text}
      </button>
    );
  };

  // update indicator position on mount and whenever location or user data changes
  useLayoutEffect(() => {
    const update = () => {
      const keys = Object.keys(linkRefs.current);
      for (const k of keys) {
        if (isActive(k)) {
          const el = linkRefs.current[k];
          if (el && sidebarRef.current) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            setIndicatorStyle({ top, height, visible: true });
            return;
          }
        }
      }
      // if no active, hide indicator
      setIndicatorStyle((s) => ({ ...s, visible: false }));
    };

    // call immediately and also on window resize
    update();

    // Also update after a short delay to account for images/icons loading
    const timer = setTimeout(update, 100);

    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      clearTimeout(timer);
    };
  }, [location.pathname, me]); // Added 'me' dependency to catch layout shifts after user data loads

  return (
    <div className="sidebar" ref={sidebarRef}>
      {/* Logo */}
      <h2 className="logo">
        <lord-icon
          src="https://cdn.lordicon.com/zruuduya.json"
          trigger="hover"
          colors={`primary:${isDarkTheme ? "#FFFFFF" : "#121331"},secondary:#08C18A`}
          style={{ width: "38px", height: "38px" }}
        ></lord-icon>
        <span className="logo-title">WasteZero</span>
      </h2>

      {/* User Info */}
      <div className="user-box">
        <div className="user-role">
          {me?.role ? me.role.toUpperCase() : ""}
        </div>
        <div className="user-name">{me?.fullName || "Guest"}</div>
        {isRestricted && (
          <div className="user-restricted-badge" title="You are restricted">
            <BanIcon />
            <span>Restricted</span>
          </div>
        )}
      </div>

      <p className="section">MAIN MENU</p>

      {/* sliding background indicator */}
      <div
        className={`nav-indicator ${indicatorStyle.visible ? "visible" : ""}`}
        style={{ top: indicatorStyle.top + "px", height: indicatorStyle.height + "px" }}
      />

      {link("Dashboard", "/home/dashboard", dashboardIcon)}
      {link(isAdmin ? "Schedule Pickups" : "Schedule Pickup", "/home/schedule", scheduleIcon)}
      {link("Opportunities", "/home/opportunities", opportunitiesIcon)}
      {link(isAdmin ? "Reports" : "Messages", "/home/messages", isAdmin ? reportsIcon : messagesIcon)}
      {!isAdmin && link("My Impact", "/home/impact", impactIcon)}
      {isAdmin && link("Admin Logs", "/home/admin", adminIcon)}

      <p className="section">SETTINGS</p>

      {link("My Profile", "/home/profile", profileIcon)}
      {link("Settings", "/home/settings", settingsIcon)}

      {link("Help & Support", "/home/help", helpIcon)}

      <button className="nav-link logout" onClick={handleLogout}>
        <img src={logoutIcon} alt="" className="nav-icon" />
        Logout
      </button>
    </div>
  );
};

export default Navbar;
