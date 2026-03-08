import React, { useState } from "react";
import "../styles/NavbarComponents-styles/SchedulePickup.css";

const SchedulePickup = () => {

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");

  const handleSubmit = async () => {

    const data = {
      address: address,
      city: city,
      pickupDate: date,
      timeSlot: timeSlot
    };

    try {
      const response = await fetch("http://localhost:3000/api/pickups/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      console.log(result);

      alert("Pickup scheduled successfully!");

    } catch (error) {
      console.error("Error scheduling pickup:", error);
    }
  };

  return (
    <div className="page">
      <h2>Schedule Pickup</h2>
      <p>Request waste collection and manage your pickups.</p>

      <div className="card">
        <h3>Request Waste Collection</h3>

        <input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <select
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value)}
        >
          <option>Select Time Slot</option>
          <option>Morning</option>
          <option>Afternoon</option>
          <option>Evening</option>
        </select>

        <button className="primary" onClick={handleSubmit}>
          Next Step
        </button>

      </div>
    </div>
  );
};

export default SchedulePickup;