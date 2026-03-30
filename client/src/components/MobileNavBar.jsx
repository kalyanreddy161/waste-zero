import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMe } from "../Services/useMe";
import useIsMobile from "../Services/useIsMobile";
import "../styles/MobileNav.css";

import dashboardIcon from "../assets/icons/dashboard.svg";
import scheduleIcon from "../assets/icons/schedule.svg";
import opportunitiesIcon from "../assets/icons/opportunities.svg";
import messagesIcon from "../assets/icons/messages.svg";
import reportsIcon from "../assets/icons/Reports.svg";
import profileIcon from "../assets/icons/profile.svg";
import adminIcon from "../assets/icons/admin.svg";

const MobileNavBar = () => {
  const { data: me } = useMe();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isMobile) return null;

  const isAdmin = me?.role === "admin";

  const items = useMemo(() => {
    if (isAdmin) {
      return [
        { key: "opportunities", label: "Opportunities", to: "/home/opportunities", icon: opportunitiesIcon },
        { key: "schedule", label: "Schedule", to: "/home/schedule", icon: scheduleIcon },
        { key: "dashboard", label: "Dashboard", to: "/home/dashboard", icon: dashboardIcon },
        { key: "reports", label: "Reports", to: "/home/messages", icon: reportsIcon },
        { key: "admin", label: "Admin Logs", to: "/home/admin", icon: adminIcon },
      ];
    }
    return [
      { key: "opportunities", label: "Opportunities", to: "/home/opportunities", icon: opportunitiesIcon },
      { key: "schedule", label: "Pickup", to: "/home/schedule", icon: scheduleIcon },
      { key: "dashboard", label: "Dashboard", to: "/home/dashboard", icon: dashboardIcon },
      { key: "messages", label: "Messages", to: "/home/messages", icon: messagesIcon },
      { key: "profile", label: "Profile", to: "/home/profile", icon: profileIcon },
    ];
  }, [isAdmin]);

  const currentPath = location.pathname === "/home" ? "/home/dashboard" : location.pathname;
  const activeIndex = items.findIndex((item) => currentPath.startsWith(item.to));

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-inner">
        {items.map((item, index) => {
          const active = activeIndex === index;
          return (
            <button
              key={item.key}
              className={`mobile-nav-item ${active ? "active" : ""}`}
              onClick={() => navigate(item.to)}
              aria-label={item.label}
            >
              <span className="mobile-nav-icon">
                <img src={item.icon} alt="" />
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavBar;
