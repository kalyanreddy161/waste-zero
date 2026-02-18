import React, { useState } from "react";
import "../styles/NavbarComponents-styles/CreateOpportunities.css";

const CreateOpportunities = () => {
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    date: "",
    duration: "",
    skills: "",
    description: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Created Opportunity:", formData);
    alert("Opportunity created successfully! (Dummy submit)");
    // Future lo API call cheyyachu
  };

  return (
    <div className="create-opportunity-page">
      <h2>Create Opportunity</h2>

      <form className="create-opportunity-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            name="title"
            placeholder="Eg: Garbage Collection Drive"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Location</label>
          <input
            type="text"
            name="location"
            placeholder="Eg: Hyderabad"
            value={formData.location}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Duration</label>
            <input
              type="text"
              name="duration"
              placeholder="Eg: 1 day / 3 weeks"
              value={formData.duration}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Required Skills</label>
          <input
            type="text"
            name="skills"
            placeholder="Eg: Cleaning, Teamwork, Communication"
            value={formData.skills}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            placeholder="Brief description about the opportunity"
            rows="4"
            value={formData.description}
            onChange={handleChange}
          ></textarea>
        </div>

        <button type="submit" className="submit-btn">
          Create Opportunity
        </button>
      </form>
    </div>
  );
};

export default CreateOpportunities;