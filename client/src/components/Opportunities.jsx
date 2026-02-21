import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/NavbarComponents-styles/Opportunities.css";

const opportunitiesData = [
  {
    id: 1,
    title: "Garbage Collection Drive",
    location: "Durgapur",
    date: "2025-12-28",
    duration: "1 day",
    skills: ["Cleaning", "Teamwork"],
    status: "OPEN",
  },
  {
    id: 2,
    title: "E-Waste Collection",
    location: "Kolkata",
    date: "2025-12-30",
    duration: "1 day",
    skills: ["Teamwork"],
    status: "OPEN",
  },
  {
    id: 3,
    title: "Community Awareness Program",
    location: "Hyderabad",
    date: "2026-01-02",
    duration: "3-6 weeks",
    skills: ["Cleaning", "Teamwork", "Communication"],
    status: "CLOSED",
  },
];

const Opportunities = () => {
  const navigate = useNavigate();

  return (
    <div className="opportunities-page">
      <div className="opportunities-header">
        <h2>Opportunities</h2>
        <button
          className="create-btn"
          onClick={() => navigate("/home/create-opportunity")}
        >
          + Create Opportunity
        </button>
      </div>

      <div className="opportunities-grid">
        {opportunitiesData.map((item) => (
          <div className="opportunity-card" key={item.id}>
            <div className="card-header">
              <h3>{item.title}</h3>
              <span
                className={`status ${
                  item.status === "OPEN" ? "open" : "closed"
                }`}
              >
                {item.status}
              </span>
            </div>

            <p className="location">📍 {item.location}</p>
            <p className="date">
              📅 {new Date(item.date).toLocaleDateString()}
            </p>
            <p className="duration">⏳ {item.duration}</p>

            <div className="skills">
              {item.skills.map((skill, i) => (
                <span key={i} className="skill-badge">
                  {skill}
                </span>
              ))}
            </div>

            <div className="actions">
              <button
                className="view-btn"
                onClick={() => navigate(`/home/opportunities/${item.id}`)}
              >
                View Details
              </button>

              <button
                className="edit-btn"
                onClick={() => alert("Edit feature coming soon")}
              >
                Edit
              </button>

              <button
                className="delete-btn"
                onClick={() => alert("Delete feature coming soon")}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Opportunities;