import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Navbar from "./Navbar";
import Topbar from "../components/Topbar";
import MobileNavBar from "../components/MobileNavBar";
import MobileDrawer from "../components/MobileDrawer";
import { API_BASE, useMe } from "../Services/useMe";
import useIsMobile from "../Services/useIsMobile";
import { useLoading } from "../Services/LoadingContext";
import socket from "../Services/socket";
import pushService from "../Services/pushService";
import impactIcon from "../assets/icons/impact.svg";
import settingsIcon from "../assets/icons/settings.svg";
import helpIcon from "../assets/icons/help.svg";
import profileIcon from "../assets/icons/profile.svg";
import logoutIcon from "../assets/icons/logout.svg";

export default function HomeLayout() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { setLoading } = useLoading();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customState, setCustomState] = useState({});

  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail || {};
      if (detail.page && detail.key) {
        setCustomState((prev) => ({ ...prev, [detail.page]: detail.key }));
      }
    };
    window.addEventListener("mobile:custom-state", handler);
    return () => window.removeEventListener("mobile:custom-state", handler);
  }, []);

  useEffect(() => {
    // Close drawer on route change to keep UX tidy
    setDrawerOpen(false);
  }, [location.pathname]);

  const navExtras = useMemo(() => {
    const isAdmin = me?.role === "admin";
    const extras = [
      { label: "My Profile", to: "/home/profile", icon: profileIcon },
      { label: "Settings", to: "/home/settings", icon: settingsIcon },
      { label: "Help & Support", to: "/home/help", icon: helpIcon },
    ];
    const logoutItem = { label: "Logout", action: "logout", icon: logoutIcon };
    if (isAdmin) return [...extras, logoutItem];
    return [{ label: "My Impact", to: "/home/impact", icon: impactIcon }, ...extras, logoutItem];
  }, [me]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      try { await pushService.unsubscribePush(); } catch (err) { }
      try { socket.disconnect(); } catch (err) { }
      queryClient.clear();
      try {
        sessionStorage.setItem(
          "global_message",
          JSON.stringify({ message: "Logout successful", type: "success" })
        );
      } catch (err) { }
    } finally {
      setLoading(false);
      setDrawerOpen(false);
      window.location.replace("/");
    }
  };

  const customConfig = useMemo(() => {
    const path = location.pathname;
    const isAdmin = me?.role === "admin";
    const defaults = { pageKey: "", links: [], active: "", currentLabel: "" };

    if (path.startsWith("/home/dashboard") || path === "/home") {
      const pageKey = "dashboard";
      const links = isAdmin
        ? []
        : [
          { key: "opportunities", label: "Opportunities" },
          { key: "mine", label: me?.role === "volunteer" ? "My Applications" : "My Opportunities" },
        ];
      const active = customState[pageKey] || (links[0]?.key || "");
      return { pageKey, links, active, currentLabel: "Dashboard" };
    }

    if (path.startsWith("/home/impact")) {
      const pageKey = "impact";
      const links = [
        { key: "opportunities", label: "Opportunities" },
        { key: "pickup", label: "Pickup" },
        { key: "co2", label: "CO₂ Saved" },
      ];
      const active = customState[pageKey] || "opportunities";
      return { pageKey, links, active, currentLabel: "My Impact" };
    }

    if (path.startsWith("/home/profile")) {
      const pageKey = "profile";
      const links = [
        { key: "profile", label: "Profile" },
        { key: "password", label: "Password" },
      ];
      const active = customState[pageKey] || "profile";
      return { pageKey, links, active, currentLabel: "Profile" };
    }

    if (path.startsWith("/home/messages")) {
      return { pageKey: "", links: [], active: "", currentLabel: "Messages" };
    }
    if (path.startsWith("/home/opportunities")) {
      return { pageKey: "", links: [], active: "", currentLabel: "Opportunities" };
    }
    if (path.startsWith("/home/schedule")) {
      return { pageKey: "", links: [], active: "", currentLabel: "Schedule & Pickup" };
    }
    if (path.startsWith("/home/admin")) {
      const pageKey = "admin";
      const links = [
        { key: "logs", label: "Admin Logs" },
        { key: "users", label: "Users Overview" },
      ];
      const active = customState[pageKey] || "logs";
      return { pageKey, links, active, currentLabel: "Admin Logs" };
    }
    if (path.startsWith("/home/settings")) {
      return { pageKey: "", links: [], active: "", currentLabel: "Settings" };
    }
    if (path.startsWith("/home/help")) {
      return { pageKey: "", links: [], active: "", currentLabel: "Help & Support" };
    }

    return defaults;
  }, [location.pathname, me, customState]);

  return (
    <>
      <div
        style={{
          ...layoutStyles.container,
          height: "100vh",
          overflow: "hidden",
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        {!isMobile && <Navbar />}
        <main
          style={{
            ...layoutStyles.main,
            height: "100vh",
            overflowY: isMobile ? "auto" : "hidden",
            paddingBottom: isMobile
              ? location.pathname.startsWith("/home/messages")
                ? 0
                : 96
              : 0,
          }}
        >
          <Topbar onMenuClick={() => setDrawerOpen(true)} />
          <Outlet />
        </main>
      </div>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        me={me}
        onLogout={handleLogout}
        currentPageLabel={customConfig.currentLabel}
        customLinks={customConfig.links}
        customPageKey={customConfig.pageKey}
        activeCustomKey={customConfig.active}
        secondaryLinks={navExtras}
      />

      <MobileNavBar />
    </>
  );
}

const layoutStyles = {
  container: {
    display: "flex",
    minHeight: "100vh",
  },
  main: {
    flex: 1,
    background: "var(--layout-main-bg)",
  },
};
