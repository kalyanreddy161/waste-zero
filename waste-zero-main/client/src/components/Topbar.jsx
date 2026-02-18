import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../Services/UserContext";
import "../styles/Topbar.css";

export default function Topbar() {
  const { user, setUser } = useContext(UserContext);
  const initial = user?.fullName ? user.fullName.trim().charAt(0).toUpperCase() : "G";
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

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
        <input className="topbar-search" placeholder="Search pickups, opportunities..." />
      </div>

      <div className="topbar-right" ref={menuRef}>
        <button className="icon-btn" aria-label="notifications">🔔</button>
        <div className="user-circle" title={user?.fullName || "Guest"} onClick={() => setOpen(!open)}>{initial}</div>

        {open && (
          <div className="topbar-menu">
            <div className="menu-content">
              <div className="menu-name">{user?.fullName || "Guest"}</div>
              <button className="menu-item" onClick={() => { setOpen(false); navigate('/home/profile'); }}>Profile</button>
              <button className="menu-item" onClick={() => { setOpen(false); navigate('/home/settings'); }}>Settings</button>
              <button
                className="menu-item menu-logout"
                onClick={async () => {
                  setOpen(false);
                  try {
                    await fetch("http://localhost:3000/auth/logout", {
                      method: "POST",
                      credentials: "include"
                    });
                  } catch (err) {
                    // ignore network errors
                  }
                  setUser(null);
                  navigate('/');
                }}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
