import React from "react";
import { useParams, useNavigate } from "react-router-dom";

const dummyData = {
  1: {
    id: 1,
    title: "garbage collection",
    description: "collection of garbage from roadside",
    date: "2025-12-28",
    duration: "1 day",
    location: "durgapur",
    skills: ["cleaning", "teamwork"],
    lat: 23.5204,
    lng: 87.3119,
  },
  2: {
    id: 2,
    title: "e-waste collection",
    description: "collecting electronic waste responsibly",
    date: "2025-12-30",
    duration: "1 day",
    location: "Kolkata",
    skills: ["teamwork"],
    lat: 22.5726,
    lng: 88.3639,
  },
};

const OpportunityDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const data = dummyData[id];

  if (!data) {
    return <h2 style={{ padding: 20 }}>Opportunity not found</h2>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{data.title}</h2>
      <p style={styles.subTitle}>Volunteer opportunity details</p>

      <div style={styles.grid}>
        {/* Left Details */}
        <div style={styles.card}>
          <p><strong>Description:</strong> {data.description}</p>
          <p><strong>Date:</strong> {data.date}</p>
          <p><strong>Duration:</strong> {data.duration}</p>
          <p><strong>Location:</strong> {data.location}</p>

          <div>
            <strong>Required Skills:</strong>
            <div style={{ marginTop: 6 }}>
              {data.skills.map((s, i) => (
                <span key={i} style={styles.skill}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Map */}
        <div style={styles.mapCard}>
          <iframe
            title="map"
            width="100%"
            height="250"
            style={{ border: 0, borderRadius: "8px" }}
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps?q=${data.lat},${data.lng}&output=embed`}
          ></iframe>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          Back
        </button>
        <button style={styles.editBtn}>Edit</button>
        <button style={styles.deleteBtn}>Delete</button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    maxWidth: "1100px",
    margin: "auto",
  },
  title: {
    fontSize: "28px",
    marginBottom: "6px",
    textTransform: "capitalize",
  },
  subTitle: {
    color: "#6b7280",
    marginBottom: "20px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  card: {
    background: "#fff",
    padding: "16px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
  },
  mapCard: {
    background: "#fff",
    padding: "8px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
  },
  skill: {
    display: "inline-block",
    background: "#e0f2fe",
    color: "#0369a1",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    marginRight: "6px",
    marginTop: "4px",
  },
  actions: {
    marginTop: "20px",
    display: "flex",
    gap: "10px",
  },
  backBtn: {
    backgroundColor: "#64748b",
    color: "#fff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  editBtn: {
    backgroundColor: "#f59e0b",
    color: "#fff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  deleteBtn: {
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    cursor: "pointer",
  },
};

export default OpportunityDetails;