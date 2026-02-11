import React, { useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../Services/UserContext";
import "../styles/Navbar.css";

const API = "http://localhost:3000/auth";

const Navbar = ({ setActivePage }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(UserContext);

  // redirect to login if session missing
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/home`, { credentials: "include" });
        if (!res.ok) navigate("/");
      } catch (err) {
        navigate("/");
      }
    };

    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
    } catch (err) {}
    navigate("/");
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  const link = (text, to) => {
    const active = isActive(to);

    return (
      <button
        className={`nav-link ${active ? "active" : ""}`}
        onClick={() => navigate(to)}
      >
        {text}
      </button>
    );
  };

  return (
    <div className="sidebar">
      <h2 className="logo">♻ <span>WasteZero</span></h2>

      <div className="user-box">
        <div className="user-role">{user?.role ? user.role.toUpperCase() : ""}</div>
        <div className="user-name">{user?.fullName || "Guest"}</div>
      </div>

      <p className="section">MAIN MENU</p>

      {link("📊 Dashboard", "/home/dashboard")}
      {link("📅 Schedule Pickup", "/home/schedule")}
      {link("🤝 Opportunities", "/home/opportunities")}
      {link("💬 Messages", "/home/messages")}
      {link("🌱 My Impact", "/home/impact")}

      <p className="section">SETTINGS</p>

      {link("👤 My Profile", "/home/profile")}
      {link("⚙ Settings", "/home/settings")}
      <button className="link-plain">❓ Help & Support</button>
      <button className="link-plain">🛠 Admin Panel</button>
      <button className="link-plain logout" onClick={handleLogout}>🚪 Logout</button>
    </div>
  );
};
export default Navbar;
