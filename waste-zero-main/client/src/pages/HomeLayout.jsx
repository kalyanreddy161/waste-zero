import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Topbar from "../components/Topbar";

export default function HomeLayout() {
  return (
    <div style={{...layoutStyles.container, height: '100vh', overflow: 'hidden'}}>
      <Navbar />
      <main style={{...layoutStyles.main, height: '100vh', overflowY: 'auto'}}>
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
}

const layoutStyles = {
  container: {
    display: "flex",
    minHeight: "100vh",
  },
  main: {
    flex: 1,
    background: "#f7f7f7",
  },
};
