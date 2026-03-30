import React, { useEffect, useRef, useState } from "react";
import "../styles/NavbarComponents-styles/MyProfile.css";

import messagesIcon from "../assets/icons/messages.svg";
import appliactionAcceptIcon from "../assets/icons/appliactionaccept.svg";
import appliactionRejectIcon from "../assets/icons/appliactionreject.svg";
import pickupIcon from "../assets/icons/pickup.svg";

const sanitizeNotificationText = (value) => {
  const text = String(value || "");
  if (!text) return "";

  return text
    .replace(/\bnetwork error\b/gi, "Failed to complete this request")
    .replace(/\berror loading\b/gi, "Failed to load")
    .replace(/\berror creating\b/gi, "Failed to create")
    .replace(/\berror updating\b/gi, "Failed to update")
    .replace(/\berror deleting\b/gi, "Failed to delete")
    .replace(/\berror removing\b/gi, "Failed to remove")
    .replace(/\berror uploading\b/gi, "Failed to upload")
    .replace(/\berror responding\b/gi, "Failed to respond")
    .replace(/\berror fetching\b/gi, "Failed to fetch")
    .replace(/\berror\b/gi, "failed");
};

const MessageBox = ({ message, type = "info", closing = false }) => {
  const color =
    type === "success"
      ? "var(--success)"
      : type === "error"
        ? "var(--danger)"
        : "var(--text-primary)";
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeExit, setSwipeExit] = useState("");
  const startRef = useRef({ x: 0, y: 0 });
  const isMobile = typeof window !== "undefined" ? window.innerWidth <= 900 : false;

  // reset on new message
  useEffect(() => {
    setDismissed(false);
    setSwiping(false);
    setSwipeX(0);
    setSwipeExit("");
  }, [message, type]);

  useEffect(() => {
    // entrance animation: appear from top a tick after mount
    const t = window.setTimeout(() => setVisible(true), 20);
    return () => window.clearTimeout(t);
  }, []);

  const style = { borderColor: color };
  const isVisible = visible || closing;
  if (dismissed) return null;

  // message can be a simple string or an object: { title, content, icon }
  const isObj = message && typeof message === 'object';
  const msgTitle = isObj && message.title
    ? sanitizeNotificationText(String(message.title).charAt(0).toUpperCase() + String(message.title).slice(1))
    : (type === 'success' ? 'Success !' : (type === 'error' ? 'Failed !' : ''));
  const msgContent = sanitizeNotificationText(isObj ? (message.content || '') : (message || ''));
  const DURATION = 3500; // ms — matches Topbar timeout
  const progressColor = type === 'error' ? 'var(--danger)' : 'var(--primary)';

  const handleTouchStart = (e) => {
    if (!isMobile) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY };
    setSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isMobile || !swiping) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    const deltaX = t.clientX - startRef.current.x;
    setSwipeX(deltaX);
  };

  const handleTouchEnd = () => {
    if (!isMobile || !swiping) return;
    const absX = Math.abs(swipeX);
    if (absX > 64) {
      const dir = swipeX > 0 ? "right" : "left";
      setSwipeExit(dir);
      window.setTimeout(() => {
        setDismissed(true);
        try { window.dispatchEvent(new CustomEvent("messagebox:dismiss")); } catch (e) { }
      }, 180);
    } else {
      setSwipeX(0);
      setSwiping(false);
    }
  };

  return (
    <div
      className={`messagebox ${isVisible ? 'show' : ''} ${closing ? 'closing' : ''} ${swiping ? 'swiping' : ''} ${swipeExit ? `swiped-${swipeExit}` : ''}`}
      style={{ ...style, "--swipe-x": `${swipeX}px` }}
      aria-live="polite"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="messagebox-inner" style={{ background: "var(--surface-primary)", color }}>
        <div className="messagebox-content">
          {msgTitle ? <div className={`msg-title ${type === 'success' ? 'success' : (type === 'error' ? 'error' : '')}`}>{msgTitle}</div> : null}
          <div className="msg-text">{msgContent}</div>
        </div>
        <div className="msg-icon" aria-hidden>
          {isObj && message.icon === 'message' ? (
            <img src={messagesIcon} alt="message" style={{ width: 28, height: 28 }} />
          ) : isObj && message.icon === 'pickup' ? (
            <img src={pickupIcon} alt="pickup" style={{ width: 28, height: 28 }} />
          ) : isObj && message.icon === 'application' ? (
            // choose accept/reject icon based on type if available
            (type === 'error' || (isObj && message.meta && message.meta.status === 'rejected')) ? (
              <img src={appliactionRejectIcon} alt="application-rejected" style={{ width: 28, height: 28 }} />
            ) : (
              <img src={appliactionAcceptIcon} alt="application" style={{ width: 28, height: 28 }} />
            )
          ) : type === 'success' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="#0aa062" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : type === 'error' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="#c0392b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : null}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <style>{`@keyframes progressShrink { from { width:100%; } to { width:0%; } }`}</style>
        <div
          className="msg-progress"
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 4,
            background: progressColor,
            width: '100%',
            transformOrigin: 'right',
            animationName: 'progressShrink',
            animationTimingFunction: 'linear',
            animationDuration: `${DURATION}ms`,
            animationFillMode: 'forwards'
          }}
        />
      </div>
    </div>
  );
};

export default MessageBox;
