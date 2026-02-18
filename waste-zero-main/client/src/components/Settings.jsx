import React from "react";
import "../styles/NavbarComponents-styles/Settings.css";

const Settings = () => {
  return (
    <div className="page">
      <h2>Settings</h2>

      <div className="card">
        <p>Dark Mode</p>
        <input type="checkbox" />
      </div>
    </div>
  );
};

export default Settings;
