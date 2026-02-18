import React from "react";
import "../styles/NavbarComponents-styles/MyImpact.css";

const MyImpact = () => {
  return (
    <div className="page">
      <h2>My Impact</h2>

      <div className="grid">
        <div className="card">♻ Total Pickups: 28</div>
        <div className="card">🌱 CO₂ Saved: 243 kg</div>
        <div className="card">🤝 Volunteer Hours: 87</div>
      </div>
    </div>
  );
};

export default MyImpact;
