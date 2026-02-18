import React, { useEffect } from "react";

export default function Loading({ isLoading }) {
  useEffect(() => {
    const scriptSrc = "https://cdn.lordicon.com/lordicon.js";
    if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
      const s = document.createElement("script");
      s.src = scriptSrc;
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  if (!isLoading) return null;

  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0, 0, 0, 0.45)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  };

  const boxStyle = {
    background: "transparent",
    padding: "8px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={overlayStyle} aria-hidden={!isLoading}>
      <div style={boxStyle}>
        <lord-icon
          src="https://cdn.lordicon.com/zruuduya.json"
          trigger="loop"
          state="loop-cycle"
          colors="primary:#121331,secondary:#ffffff"
          style={{ width: "180px", height: "180px" }}
        ></lord-icon>
      </div>
    </div>
  );
}
