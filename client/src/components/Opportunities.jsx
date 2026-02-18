import React from "react";
import "../styles/NavbarComponents-styles/Opportunities.css";

const Opportunities = () => {
  return (
    <div className="page">
      <h2>Volunteer Opportunities</h2>

      <div className="grid">
        {[
          "Beach Cleanup Drive",
          "Recycling Workshop",
          "School Education Program",
        ].map((title, i) => (
          <div className="card" key={i}>
            <h4>{title}</h4>
            <p>Help the community through responsible waste management.</p>
            <button className="primary">Apply Now</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Opportunities;
