import { Routes, Route } from "react-router-dom";
import "./App.css";
import Register from "./pages/Register.jsx";
import HomeLayout from "./pages/HomeLayout.jsx";
import Dashboard from "./components/Dashboard";
import SchedulePickup from "./components/SchedulePickup";
import Opportunities from "./components/Opportunities";
import Messages from "./components/Messages";
import MyImpact from "./components/MyImpact";
import Settings from "./components/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Register />} />
      <Route path="/home" element={<HomeLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="schedule" element={<SchedulePickup />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="messages" element={<Messages />} />
        <Route path="impact" element={<MyImpact />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
