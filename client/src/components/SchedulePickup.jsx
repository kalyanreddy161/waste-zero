import React from "react";
import "../styles/NavbarComponents-styles/SchedulePickup.css";

const SchedulePickup = () => {
  return (
    <div className="page">
      <h2>Schedule Pickup</h2>
      <p>Request waste collection and manage your pickups.</p>

      <div className="card">
        <h3>Request Waste Collection</h3>

        <input placeholder="Address" />
        <input placeholder="City" />
        <input type="date" />
        <select>
          <option>Select Time Slot</option>
          <option>Morning</option>
          <option>Afternoon</option>
          <option>Evening</option>
        </select>

        <button className="primary">Next Step</button>
      </div>
    </div>
  );
};

export default SchedulePickup;
