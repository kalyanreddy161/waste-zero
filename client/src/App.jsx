import { Routes, Route } from "react-router-dom";
import "./App.css";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}
