import { Routes, Route } from "react-router-dom";
import "./App.css";
import Register from "./pages/Register.jsx";
import HomeLayout from "./pages/HomeLayout.jsx";
import Dashboard from "./components/Dashboard";
import SchedulePickup from "./components/SchedulePickup";
import Opportunities from "./components/Opportunities";
import Messages from "./components/Messages.jsx";
import MyImpact from "./components/MyImpact";
import MyProfile from "./components/MyProfile";
import Settings from "./components/Settings";
import HelpSupport from "./components/HelpSupport";
import AdminPanel from "./components/AdminPanel";
import Loading from "./components/Loading";
import { useLoading } from "./Services/LoadingContext";

export default function App() {
  const { isLoading } = useLoading();

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
      </Routes>
    </>
  );
}
