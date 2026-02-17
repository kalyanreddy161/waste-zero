import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../Services/UserContext";
import { useLoading } from "../Services/LoadingContext";
import "../styles/Topbar.css";

// ✅ Import SVG icons
import profile from "../assets/icons/profile.svg";
import settings from "../assets/icons/settings.svg";
import logout from "../assets/icons/logout.svg";
import searchIcon from "../assets/icons/search.svg";
import NotificationBell from "./NotificationBell";

export default function Topbar() {
  const { user, setUser } = useContext(UserContext);
  const initial = user?.fullName ? user.fullName.trim().charAt(0).toUpperCase() : "G";
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { setLoading } = useLoading();

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-search-wrapper">
          <img src={searchIcon} alt="Search" className="search-icon" />
          <input className="topbar-search" placeholder="Search pickups, opportunities..." />
        </div>
      </div>

      <div className="topbar-right" ref={menuRef}>
        <div className="icon-btn" aria-label="notifications"><NotificationBell /></div>
        <div className="user-circle" title={user?.fullName || "Guest"} onClick={() => setOpen(!open)}>{initial}</div>

        {open && (
          <div className="topbar-menu">
            <div className="menu-content">
              <div className="menu-name">{user?.fullName || "Guest"}</div>
              <button className="menu-item" onClick={() => { setOpen(false); navigate('/home/profile'); }}><img src={profile} alt="Profile" className="menu-icon" /> Profile</button>
              <button className="menu-item" onClick={() => { setOpen(false); navigate('/home/settings'); }}><img src={settings} alt="Settings" className="menu-icon" /> Settings</button>
              <button
                className="menu-item menu-logout"
                onClick={async () => {
                  setOpen(false);
                  try {
                    // show global loader during logout
                    setLoading(true);
                    await fetch("http://localhost:3000/auth/logout", {
                      method: "POST",
                      credentials: "include"
                    });
                  } catch (err) {
                    // ignore network errors
                  } finally {
                    setLoading(false);
                  }
                  setUser(null);
                  navigate('/');
                }}
              >
                <img src={logout} alt="Logout" className="menu-icon" /> Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
