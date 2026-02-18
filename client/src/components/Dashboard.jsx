import React from "react";
import "../styles/NavbarComponents-styles/Dashboard.css";

const Dashboard = () => {
  return (
    <div className="page">
      <h2>Dashboard</h2>
      <p style={{ color: "#777" }}>
        Welcome back, Admin User! Here's your waste management overview.
      </p>

      {/* Stats Cards */}
      <div className="grid">
        <div className="card">
          <p>Total Pickups</p>
          <h3>28</h3>
          <span style={{ color: "green" }}>+7.2% from last month</span>
        </div>

        <div className="card">
          <p>Recycled Items</p>
          <h3>635</h3>
          <span style={{ color: "green" }}>+12.4% from last month</span>
        </div>

        <div className="card">
          <p>CO₂ Saved (kg)</p>
          <h3>243</h3>
          <span style={{ color: "green" }}>+18.3% from last month</span>
        </div>

        <div className="card">
          <p>Volunteer Hours</p>
          <h3>87</h3>
          <span style={{ color: "red" }}>-3.1% from last month</span>
        </div>
      </div>

      {/* Extra content below to demonstrate scrolling */}
      <h3 className="section-title">Volunteer Opportunities</h3>
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div className="card" style={{ flex: 1 }}>
          <h4>Beach Cleanup Drive</h4>
          <p>Join us for a day of cleaning up the shoreline and protecting marine life.</p>
          <button className="primary">Apply Now</button>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h4>Recycling Workshop</h4>
          <p>Teach community members about proper recycling techniques.</p>
          <button className="primary">Apply Now</button>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h4>School Education Program</h4>
          <p>Visit schools to raise awareness about waste management.</p>
          <button className="primary">Apply Now</button>
        </div>
      </div>

      <h3 className="section-title">Recent Messages</h3>
      <div className="recent-list">
        {Array.from({ length: 12 }).map((_, i) => (
          <div className="recent-item" key={i}>
            <strong>Admin User</strong>
            <p style={{ margin: "6px 0 0" }}>Thank you for your dedication to the cause.</p>
            <small style={{ color: "#999" }}>05:3{i % 10} PM</small>
          </div>
        ))}
      </div>
    </div>
  );
};

/* Helper UI (inside same file – NOT extra components externally) */

const StatCard = ({ title, value, change }) => (
  <div style={styles.card}>
    <p>{title}</p>
    <h3>{value}</h3>
    <span style={{ color: change.includes("-") ? "red" : "green" }}>
      {change} from last month
    </span>
  </div>
);

const Progress = ({ label, value }) => (
  <div style={{ marginBottom: "8px" }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div style={styles.progressBar}>
      <div style={{ ...styles.progressFill, width: `${value}%` }} />
    </div>
  </div>
);

const styles = {
  container: {
    padding: "20px",
    flex: 1,
    background: "#f7f7f7",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginTop: "20px",
  },
  card: {
    background: "#fff",
    padding: "16px",
    borderRadius: "6px",
    boxShadow: "0 0 5px rgba(0,0,0,0.05)",
  },
  bottom: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "16px",
    marginTop: "20px",
  },
  box: {
    background: "#fff",
    padding: "16px",
    borderRadius: "6px",
  },
  progressBar: {
    height: "6px",
    background: "#eee",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#4caf50",
  },
};

export default Dashboard;
