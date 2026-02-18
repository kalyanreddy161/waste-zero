import React, { useEffect, useContext, useRef, useState, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../Services/UserContext";
import { useLoading } from "../Services/LoadingContext";
import "../styles/Navbar.css";

// ✅ Import SVG icons
import dashboardIcon from "../assets/icons/dashboard.svg";
import scheduleIcon from "../assets/icons/schedule.svg";
import opportunitiesIcon from "../assets/icons/opportunities.svg";
import messagesIcon from "../assets/icons/messages.svg";
import impactIcon from "../assets/icons/impact.svg";
import profileIcon from "../assets/icons/profile.svg";
import settingsIcon from "../assets/icons/settings.svg";
import logoutIcon from "../assets/icons/logout.svg";
import helpIcon from "../assets/icons/help.svg";
import adminIcon from "../assets/icons/admin.svg";

const API = "http://localhost:3000/auth";

const Navbar = ({ setActivePage }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useContext(UserContext);
  const { setLoading } = useLoading();

  // refs for each nav link so we can position the sliding indicator
  const linkRefs = useRef({});
  const sidebarRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, visible: false });

  // 🔐 check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/home`, { credentials: "include" });
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

  // 🚪 logout
  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch(`${API}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    finally {
      setLoading(false);
    }

    setUser(null);
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

  // update indicator position on mount and whenever location changes
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
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [location.pathname]);

  return (
    <div className="sidebar" ref={sidebarRef}>
      {/* Logo */}
      <h2 className="logo">
        <lord-icon
          src="https://cdn.lordicon.com/zruuduya.json"
          trigger="hover"
          colors="primary:#121331,secondary:#08C18A"
          style={{ width: "34px", height: "34px" }}
        ></lord-icon>
        <span className="logo-title">WasteZero</span>
      </h2>

      {/* User Info */}
      <div className="user-box">
        <div className="user-role">
          {user?.role ? user.role.toUpperCase() : ""}
        </div>
        <div className="user-name">{user?.fullName || "Guest"}</div>
      </div>

      <p className="section">MAIN MENU</p>

      {/* sliding background indicator */}
      <div
        className={`nav-indicator ${indicatorStyle.visible ? "visible" : ""}`}
        style={{ top: indicatorStyle.top + "px", height: indicatorStyle.height + "px" }}
      />

      {link("Dashboard", "/home/dashboard", dashboardIcon)}
      {link("Schedule Pickup", "/home/schedule", scheduleIcon)}
      {link("Opportunities", "/home/opportunities", opportunitiesIcon)}
      {link("Messages", "/home/messages", messagesIcon)}
      {link("My Impact", "/home/impact", impactIcon)}

      <p className="section">SETTINGS</p>

      {link("My Profile", "/home/profile", profileIcon)}
      {link("Settings", "/home/settings", settingsIcon)}

      {link("Help & Support", "/home/help", helpIcon)}
      {link("Admin Panel", "/home/admin", adminIcon)}

      <button className="nav-link logout" onClick={handleLogout}>
        <img src={logoutIcon} alt="" className="nav-icon" />
        Logout
      </button>
    </div>
  );
};

export default Navbar;
