import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";

const API = "http://localhost:3000/auth";

export default function Dashboard() {
  const navigate = useNavigate();

  // 🔐 Check session when dashboard loads
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/dashboard`, {
          credentials: "include",
        });

        if (!res.ok) {
          navigate("/");
        }
      } catch {
        navigate("/");
      }
    };

    checkAuth();
  }, [navigate]);

  // 🚪 Logout
  const handleLogout = async () => {
    await fetch(`${API}/logout`, {
      method: "POST",
      credentials: "include",
    });

    navigate("/");
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-card">
        <h1>Welcome to User Dashboard</h1>
        <p>
          This is your personal dashboard where you can view activities,
          manage your profile, and track your contributions in WasteZero.
        </p>

        <button className="primary-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
