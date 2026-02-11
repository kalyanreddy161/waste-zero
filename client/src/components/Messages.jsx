import React from "react";
import "../styles/NavbarComponents-styles/Messages.css";

const Messages = () => {
  return (
    <div className="page">
      <h2>Messages</h2>

      <div style={{ display: "flex", gap: "20px" }}>
        <div className="card" style={{ width: "30%" }}>
          <p><b>User A</b></p>
          <p><b>User B</b></p>
        </div>

        <div className="card" style={{ width: "70%" }}>
          <p>No conversation selected</p>
          <input placeholder="Type a message..." />
        </div>
      </div>
    </div>
  );
};

export default Messages;
