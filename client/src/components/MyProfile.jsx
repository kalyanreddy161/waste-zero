import React, { useContext } from "react";
import { UserContext } from "../Services/UserContext";
import "../styles/Topbar.css";

const MyProfile = () => {
  const { user } = useContext(UserContext);

  return (
    <div className="page">
      <h1>My Profile</h1>
      <div className="profile-card">
        <p>
          <strong>Name:</strong> {user?.fullName || "Guest"}
        </p>
        <p>
          <strong>Email:</strong> {user?.email || "—"}
        </p>
        <p>
          <strong>Role:</strong> {user?.role || "User"}
        </p>
      </div>
    </div>
  );
};

export default MyProfile;
