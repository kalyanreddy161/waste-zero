import { Routes, Route } from "react-router-dom";
import "./App.css";
import Register from "./pages/Register.jsx";
import HomeLayout from "./pages/HomeLayout.jsx";
import Dashboard from "./components/Dashboard";
import SchedulePickup from "./components/SchedulePickup";
import Opportunities from "./components/Opportunities";
import Messages from "./components/Messages";
import MyImpact from "./components/MyImpact";
import MyProfile from "./components/MyProfile";
import Settings from "./components/Settings";
import HelpSupport from "./components/HelpSupport";
import AdminPanel from "./components/AdminPanel";
import Loading from "./components/Loading";
import PageNotFound from "./components/PageNotFound";
import { useLoading } from "./Services/LoadingContext";
import { useEffect } from "react";
import socket from "./Services/socket.js";
import {
  initializeTheme,
  syncThemeWithStorage,
  syncThemeWithSystemPreference,
} from "./Services/theme";

export default function App() {
  const { isLoading } = useLoading();

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().catch(() => { });
    }

    // ensure socket connects (socket autoConnect true)
    // we don't need to do anything else here but keep import to initialize
    return () => {
      try { socket.off(); } catch (e) { }
    };
  }, []);

  useEffect(() => {
    initializeTheme();

    const cleanupSystemTheme = syncThemeWithSystemPreference();
    const cleanupStoredTheme = syncThemeWithStorage();

    return () => {
      cleanupSystemTheme();
      cleanupStoredTheme();
    };
  }, []);

  return (
    <>
      <Loading isLoading={isLoading} />
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/home" element={<HomeLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="schedule" element={<SchedulePickup />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="messages" element={<Messages />} />
          <Route path="impact" element={<MyImpact />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="help" element={<HelpSupport />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
}
