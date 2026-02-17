import React, { useEffect, useRef, useState } from "react";
import "../styles/NavbarComponents-styles/MyProfile.css";

const MessageBox = ({ message, type = "info", closing = false }) => {
  const color = type === "success" ? "#0aa062" : type === "error" ? "#c0392b" : "#333";
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // entrance animation: appear from top a tick after mount
    const t = window.setTimeout(() => setVisible(true), 20);
    return () => window.clearTimeout(t);
  }, []);

  // keep transform stable on closing; parent will set `closing` and remove after fade
  useEffect(() => {
    if (closing) {
      setVisible(true);
    }
  }, [closing]);

  const style = { borderColor: color };

  const title = type === 'success' ? 'Success !' : (type === 'error' ? 'Failed !' : 'Notice');

  return (
    <div
      ref={ref}
      className={`messagebox ${visible ? 'show' : ''} ${closing ? 'closing' : ''}`}
      style={style}
      aria-live="polite"
    >
      <div className="messagebox-inner" style={{ background: "white", color }}>
        <div className="messagebox-content">
          <div className={`msg-title ${type === 'success' ? 'success' : (type === 'error' ? 'error' : '')}`}>{title}</div>
          <div className="msg-text">{message}</div>
        </div>
        <div className="msg-icon" aria-hidden>
          {type === 'success' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="#0aa062" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : type === 'error' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="#c0392b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MessageBox;
