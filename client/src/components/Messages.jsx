/**
 * Messages.jsx
 *
 * Single-file implementation of the complete chat UI.
 * Data flow:
 *   - HTTP (fetch, no axios): load conversations, messages, search users, create groups
 *   - Socket.IO (existing socket singleton): send/receive/delete messages, typing, presence
 *   - React Query: cache conversations + messages; invalidate/update on socket events
 *
 * UI keeps ALL classes from Messages.css — colors and structure are untouched.
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import EmojiPicker, { Theme as EmojiTheme } from "emoji-picker-react";
import TypingLoader from './TypingLoader';
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import "../styles/NavbarComponents-styles/Messages.css";
import socket from "../Services/socket";
import { useMe, API_BASE } from "../Services/useMe";
import MessageBox from "./MessageBox";
import useIsMobile from "../Services/useIsMobile";

const API = `${API_BASE}/api/chat`;

/* ─── helpers ─── */
const fetcher = (url) =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("fetch failed");
    return r.json();
  });

const MESSAGE_SUBJECTS = new Set([
  "User Report",
  "ACCOUNT SUSPENSION",
  "ACCOUNT RESTRICTION",
]);

function getStructuredMessageSubject(content = "") {
  const firstLine = String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "";
  return MESSAGE_SUBJECTS.has(firstLine) ? firstLine : "";
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ─── Date helpers ─── */
function stripDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDateLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = stripDate(d) === stripDate(today);
  const isYesterday = stripDate(d) === stripDate(yesterday);

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  // DD-MM-YYYY
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function initials(name = "") {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ─── Avatar ─── */
function Avatar({ name = "", size = 46 }) {
  const variants = ["", "secondary", "accent"];
  const idx = name.charCodeAt(0) % variants.length;
  const variant = variants[idx];
  return (
    <div
      className={`msg-chat-avatar${variant ? ` ${variant}` : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.37 }}
    >
      {initials(name)}
    </div>
  );
}

/* ─── DateSeparator ─── */
function DateSeparator({ label }) {
  return (
    <div className="msg-date-divider">
      <span>{label}</span>
    </div>
  );
}



/* ─────────────────────────────────────────────
   ChatItem
───────────────────────────────────────────── */
function ChatItem({ conv, isActive, onClick, onlineUsers, typingUsers }) {
  const isOnline = onlineUsers.has(conv.otherUserId);
  const preview =
    getStructuredMessageSubject(conv.lastMessage?.content || "") ||
    conv.lastMessage?.content ||
    "No messages yet";
  const isTyping = typingUsers && typingUsers[conv._id];
  return (
    <div
      className={`msg-chat-item${isActive ? " active" : ""}`}
      onClick={() => onClick(conv)}
    >
      <div style={{ position: "relative" }}>
        <Avatar name={conv.name} />
        {conv.type === "direct" && isOnline && (
          <span
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--primary)",
              border: "2px solid var(--surface-primary)",
            }}
          />
        )}
      </div>
      <div className="msg-chat-info">
        <div className="msg-chat-name">{conv.name}</div>
        <div className="msg-chat-preview">{isTyping ? <TypingLoader /> : preview}</div>
      </div>
      <div className="msg-chat-meta">
        {conv._hasUnread && (
          <span
            title="New messages"
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--primary)",
              marginRight: 8,
              verticalAlign: "middle",
            }}
          />
        )}
        <span className="msg-chat-time">
          {fmtTime(conv.lastMessage?.timestamp || conv.updatedAt)}
        </span>
      </div>
    </div>
  );
}




/* ─────────────────────────────────────────────
   MessageRow — renders one message with the dropdown
───────────────────────────────────────────── */
function MessageRow({ msg, isSent, myId, onDelete, isLastSent, showNotification }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hasAttachments = msg.attachments && msg.attachments.length > 0;
  const att = hasAttachments ? msg.attachments[0] : null;
  const handleAttachmentDownload = async (url, fileName, successMessage) => {
    const ok = await downloadFile(url, fileName);
    showNotification(ok ? successMessage : "Download failed", ok ? "success" : "error");
    setOpen(false);
  };

  return (
    <div className={`msg-row ${isSent ? "sent" : "received"} msg-fade-in`}>
      {/* avatar removed for received messages as per UI update */}
      <div className="msg-bubble-wrap">
        <div className="msg-item-container">
          {isSent && (
            <div className="msg-action" ref={menuRef}>
              <button
                className="msg-action-btn"
                title="Options"
                onClick={() => setOpen((v) => !v)}
              >
                <DotsIcon />
              </button>

              {open && (
                <div className="msg-dropdown-menu">
                  {att?.type === "image" && (
                    <button
                      className="msg-dropdown-item"
                      onClick={() => handleAttachmentDownload(att.url, att.fileName || "image.jpg", "Image downloaded")}
                    >
                      <DownloadIcon /> Download Image
                    </button>
                  )}
                  {att?.type === "file" && (
                    <button
                      className="msg-dropdown-item"
                      onClick={() => handleAttachmentDownload(att.url, att.fileName || "document", "File downloaded")}
                    >
                      <DownloadIcon /> Download File
                    </button>
                  )}
                  {att?.type === "audio" && (
                    <button
                      className="msg-dropdown-item"
                      onClick={() => handleAttachmentDownload(att.url, att.fileName || "audio.mp3", "Audio downloaded")}
                    >
                      <DownloadIcon /> Download Audio
                    </button>
                  )}

                  {msg.content && (
                    <button
                      className="msg-dropdown-item"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content)
                          .then(() => showNotification("Copied to clipboard", "success"))
                          .catch(() => showNotification("Copy failed", "error"));
                        setOpen(false);
                      }}
                    >
                      <CopyIcon /> Copy
                    </button>
                  )}

                  {isSent && (
                    <button
                      className="msg-dropdown-item danger"
                      onClick={() => {
                        setOpen(false);
                        onDelete(msg._id);
                      }}
                    >
                      <TrashIcon /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className={`msg-content`}>
            <div
              className={`msg-bubble${hasAttachments && !msg.content ? " media-bubble" : ""}`}
              style={hasAttachments && !msg.content ? { padding: 0, background: "none", boxShadow: "none" } : {}}
            >
              {/* Content */}
              {att?.type === "image" && (
                <ImageAttachment url={att.url} fileName={att.fileName} />
              )}
              {att?.type === "audio" && <AudioAttachment url={att.url} isSent={isSent} />}
              {att?.type === "file" && (
                <DocAttachment
                  url={att.url}
                  fileName={att.fileName}
                  size={att.size}
                  isSent={isSent}
                  onDownload={handleAttachmentDownload}
                />
              )}
              {msg.content && <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>}
            </div>
          </div>

          {!isSent && (
            <div className="msg-action" ref={menuRef}>
              <button
                className="msg-action-btn"
                title="Options"
                onClick={() => setOpen((v) => !v)}
              >
                <DotsIcon />
              </button>

              {open && (
                <div className="msg-dropdown-menu">
                  {att?.type === "image" && (
                    <button
                      className="msg-dropdown-item"
                      onClick={() => handleAttachmentDownload(att.url, att.fileName || "image.jpg", "Image downloaded")}
                    >
                      <DownloadIcon /> Download Image
                    </button>
                  )}
                  {att?.type === "file" && (
                    <button
                      className="msg-dropdown-item"
                      onClick={() => handleAttachmentDownload(att.url, att.fileName || "document", "File downloaded")}
                    >
                      <DownloadIcon /> Download File
                    </button>
                  )}
                  {att?.type === "audio" && (
                    <button
                      className="msg-dropdown-item"
                      onClick={() => handleAttachmentDownload(att.url, att.fileName || "audio.mp3", "Audio downloaded")}
                    >
                      <DownloadIcon /> Download Audio
                    </button>
                  )}

                  {msg.content && (
                    <button
                      className="msg-dropdown-item"
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content)
                          .then(() => showNotification("Copied to clipboard", "success"))
                          .catch(() => showNotification("Copy failed", "error"));
                        setOpen(false);
                      }}
                    >
                      <CopyIcon /> Copy
                    </button>
                  )}

                  {isSent && (
                    <button
                      className="msg-dropdown-item danger"
                      onClick={() => {
                        setOpen(false);
                        onDelete(msg._id);
                      }}
                    >
                      <TrashIcon /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Timestamp + status */}
        <div className="msg-bubble-time">
          {fmtTime(msg.timestamp)}
          {isSent && isLastSent && (
            <span
              style={{
                fontSize: 10,
                marginLeft: 4,
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              {msg.status === "seen"
                ? "seen"
                : msg.status === "delivered"
                  ? "delivered"
                  : "sent"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Image Attachment ─── */
function ImageAttachment({ url, fileName }) {
  return (
    <div className="msg-image-wrap">
      <img src={url} alt={fileName || "image"} onClick={() => window.dispatchEvent(new CustomEvent('open-image-modal', { detail: { url, fileName } }))} style={{ cursor: 'zoom-in' }} />
    </div>
  );
}

/* ─── Audio Attachment ─── */
function AudioAttachment({ url, isSent }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => { });
    }
    setPlaying((v) => !v);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const pct =
      (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100;
    setProgress(pct);
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    audioRef.current.currentTime =
      (x / rect.width) * audioRef.current.duration;
  };

  return (
    <div className="msg-audio-player">
      <audio
        ref={audioRef}
        src={url}
        muted={muted}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        style={{ display: "none" }}
      />
      <button className="msg-audio-play-btn" onClick={togglePlay}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="msg-audio-controls">
        <div className="msg-audio-progress" onClick={handleProgressClick}>
          <div className="msg-audio-filled" style={{ width: `${progress}%` }} />
        </div>
        <div className="msg-audio-bottom">
          <span className="msg-audio-time-info">
            {audioRef.current?.duration
              ? `${Math.floor(audioRef.current.currentTime)}s / ${Math.floor(audioRef.current.duration)}s`
              : ""}
          </span>
          <button
            className="msg-audio-mute-btn"
            onClick={() => setMuted((v) => !v)}
          >
            {muted ? <MuteIcon /> : <VolumeIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Document Attachment ─── */
function DocAttachment({ url, fileName, size, isSent, onDownload }) {
  const fmtSize = size
    ? size > 1048576
      ? `${(size / 1048576).toFixed(1)} MB`
      : `${(size / 1024).toFixed(0)} KB`
    : "";
  return (
    <div className="msg-doc-box">
      <div className="msg-doc-icon">
        <DocIcon />
      </div>
      <div className="msg-doc-info">
        <div className="msg-doc-name">{fileName || "Document"}</div>
        {fmtSize && <div className="msg-doc-size">{fmtSize}</div>}
      </div>
      <button
        className="msg-doc-dl-btn"
        onClick={() => {
          if (onDownload) {
            onDownload(url, fileName || "document", "File downloaded");
            return;
          }
          downloadFile(url, fileName || "document");
        }}
        title="Download"
      >
        <DownloadIcon />
      </button>
    </div>
  );
}

/* ─── download helper ─── */
async function downloadFile(url, fileName) {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("fetch-failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return true;
  } catch (e) {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (err) {
      return false;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const Messages = () => {
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const myId = me?._id || me?.id || "";
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [activeConv, setActiveConv] = useState(null); // full conversation object
  const [mobileView, setMobileView] = useState("split"); // list | chat | split (desktop)
  const [inputText, setInputText] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({}); // conversationId → true/false
  const [isTyping, setIsTyping] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef(null);
  const headerMenuButtonRef = useRef(null);
  const [attachmentPending, setAttachmentPending] = useState(null); // { url, fileName, fileType, size }
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: "", type: "info", closing: false });
  const [imageModal, setImageModal] = useState({ open: false, url: "", fileName: "" });
  const [manualSeparators, setManualSeparators] = useState({}); // { convId: Set<dateStr> }
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [emojiTheme, setEmojiTheme] = useState(() =>
    document.documentElement.classList.contains("dark") ? EmojiTheme.DARK : EmojiTheme.LIGHT
  );
  const typingTimer = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const attachMenuRef = useRef(null);
  const attachButtonRef = useRef(null);
  const preserveScrollRef = useRef({ active: false, prevScrollHeight: 0, prevScrollTop: 0 });
  const shouldScrollRef = useRef(true);
  const prevMessagesLenRef = useRef(0);
  const handledRouteOpenRef = useRef("");

  // Announce presence: user is viewing the Messages page
  useEffect(() => {
    try {
      socket.emit("presence:in-messages", true);
      window.__IN_MESSAGES = true;
    } catch (e) { }
    return () => {
      try {
        socket.emit("presence:in-messages", false);
        window.__IN_MESSAGES = false;
      } catch (e) { }
    };
  }, []);

  useEffect(() => {
    const onOpenImage = (e) => {
      const d = e && e.detail ? e.detail : null;
      if (!d || !d.url) return;
      setImageModal({ open: true, url: d.url, fileName: d.fileName || "" });
    };
    window.addEventListener('open-image-modal', onOpenImage);
    return () => window.removeEventListener('open-image-modal', onOpenImage);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && imageModal.open) setImageModal({ open: false, url: "", fileName: "" });
      if (e.key === "Escape") setShowEmojiPicker(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imageModal.open]);

  useEffect(() => {
    if (!isMobile) {
      if (mobileView !== "split") setMobileView("split");
      return;
    }
    const nextView = activeConv ? "chat" : "list";
    if (mobileView !== nextView) setMobileView(nextView);
  }, [isMobile, activeConv, mobileView]);

  useEffect(() => {
    const handleThemeChange = () => {
      setEmojiTheme(
        document.documentElement.classList.contains("dark") ? EmojiTheme.DARK : EmojiTheme.LIGHT
      );
    };

    handleThemeChange();
    window.addEventListener("themechange", handleThemeChange);
    return () => window.removeEventListener("themechange", handleThemeChange);
  }, []);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (event) => {
      const target = event.target;
      if (emojiPickerRef.current && emojiPickerRef.current.contains(target)) return;
      if (emojiButtonRef.current && emojiButtonRef.current.contains(target)) return;
      setShowEmojiPicker(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Expose the currently-open conversation globally so other UI (Topbar)
  // can suppress notifications for messages that belong to the open chat.
  useEffect(() => {
    try {
      if (activeConv && activeConv._id) window.__ACTIVE_CONV_ID = String(activeConv._id);
      else window.__ACTIVE_CONV_ID = null;
    } catch (e) { }
    return () => {
      try {
        window.__ACTIVE_CONV_ID = null;
      } catch (e) { }
    };
  }, [activeConv && activeConv._id]);

  useEffect(() => {
    setShowEmojiPicker(false);
  }, [activeConv && activeConv._id]);

  /* ────────── React Query: Conversations ────────── */
  const { data: conversations = [], refetch: refetchConvs } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetcher(`${API}/conversations`),
    staleTime: 30_000,
  });

  // On mount / when conversations load, fetch existing message notifications
  // so we can mark conversations that already have unread messages.
  useEffect(() => {
    const markUnreadFromNotifications = async () => {
      try {
        const base = API.split('/api')[0];
        const res = await fetch(`${base}/notifications`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const convIds = new Set(
          data.filter((n) => n.type === 'message' && n.conversationId).map((n) => String(n.conversationId))
        );
        if (convIds.size > 0) {
          queryClient.setQueryData(["conversations"], (old = []) =>
            old.map((c) => (convIds.has(String(c._id)) ? { ...c, _hasUnread: true } : c))
          );
        }
      } catch (e) { }
    };
    markUnreadFromNotifications();
  }, [conversations.length]);

  /* ────────── React Query: Messages ────────── */
  const { data = [] } = useQuery({
    queryKey: ["messages", activeConv?._id],
    queryFn: () =>
      fetcher(`${API}/messages?conversationId=${activeConv._id}`),
    enabled: !!activeConv,
    staleTime: Infinity,
  });

  // Expose messages array (already oldest -> newest from server)
  const messages = data || [];

  /* ────────── User Search ────────── */
  const { data: searchResults = [] } = useQuery({
    queryKey: ["userSearch", searchQuery],
    queryFn: () =>
      !isAdmin && searchQuery.trim().length >= 1
        ? fetcher(`${API}/users/search?q=${encodeURIComponent(searchQuery)}`)
        : [],
    enabled: !isAdmin && searchQuery.trim().length >= 1,
    staleTime: 10_000,
  });

  /* ────────── Scroll to bottom on new messages ────────── */
  useEffect(() => {
    const area = messagesEndRef.current && messagesEndRef.current.parentElement;

    // If we're preserving scroll (loading older messages), keep user's view
    if (preserveScrollRef.current.active && area) {
      const newH = area.scrollHeight;
      const delta = newH - preserveScrollRef.current.prevScrollHeight;
      area.scrollTop = preserveScrollRef.current.prevScrollTop + delta;
      preserveScrollRef.current.active = false;
      // update prevMessagesLen to current to avoid accidental autoscroll
      prevMessagesLenRef.current = messages.length;
      return;
    }

    const prevLen = prevMessagesLenRef.current || 0;
    const currLen = messages.length;

    // Decide whether to scroll and which behavior to use.
    // - when opening a conversation we set shouldScrollRef.current === 'auto'
    //   so the jump to bottom is instant (no long smooth animation)
    // - when new messages arrive (currLen > prevLen) use smooth scrolling
    // - when some code set shouldScrollRef.current === true, use smooth
    try {
      let doScroll = false;
      let behavior = "smooth";

      if (shouldScrollRef.current === "auto") {
        doScroll = true;
        behavior = "auto";
      } else if (shouldScrollRef.current === true) {
        doScroll = true;
        behavior = "smooth";
      } else if (currLen > prevLen) {
        doScroll = true;
        behavior = "smooth";
      }

      if (doScroll) {
        messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
      }
    } catch (e) { }
    // reset to default (no auto-scroll) after handling
    shouldScrollRef.current = false;

    prevMessagesLenRef.current = currLen;
  }, [messages.length, activeConv && activeConv._id]);

  // When opening/selecting a conversation, request an instant jump to bottom
  // (avoid long smooth animation when there are many messages).
  useEffect(() => {
    try {
      shouldScrollRef.current = "auto";
    } catch (e) { }
  }, [activeConv && activeConv._id]);

  /* ────────── Scroll when typing indicator appears ────────── */
  useEffect(() => {
    try {
      if (!activeConv) return;
      const isTyping = !!typingUsers[activeConv._id];
      if (isTyping) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    } catch (e) { }
  }, [typingUsers, activeConv && activeConv._id]);



  /* ────────── Ensure fresh messages are loaded when opening a conversation ────────── */
  useEffect(() => {
    try {
      if (!activeConv || !activeConv._id) return;
      // Invalidate cached messages for this conversation so React Query
      // fetches the latest messages that may have arrived while the user
      // was not on the Messages page.
      queryClient.invalidateQueries(["messages", String(activeConv._id)]);
    } catch (e) { }
  }, [activeConv && activeConv._id]);

  /* ────────── Mark messages seen when opening/switching conversations ────────── */
  useEffect(() => {
    if (!activeConv) return;
    try {
      socket.emit("message-seen", { conversationId: activeConv._id });
      // Inform other UI (Topbar) to clear notifications for this conversation
      window.dispatchEvent(new CustomEvent("notify:clear-conversation", { detail: { conversationId: String(activeConv._id) } }));
      // Clear persisted notifications for this conversation on the server
      try {
        const base = API.split('/api')[0];
        fetch(`${base}/notifications/clear-chat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: String(activeConv._id) }),
        }).catch(() => { });
      } catch (e) { }
      // Remove unread marker locally
      try {
        queryClient.setQueryData(['conversations'], (old = []) =>
          old.map((c) => (String(c._id) === String(activeConv._id) ? { ...c, _hasUnread: false } : c))
        );
      } catch (e) { }
      shouldScrollRef.current = "auto";
    } catch (e) { }
  }, [activeConv]);

  /* ────────── Socket event handlers ────────── */
  useEffect(() => {
    /* receive-message: add to the active conversation's cache */
    const onReceive = (msg) => {
      const convId = String(msg.conversationId);

      // Update messages cache if it's the open conversation
      queryClient.setQueryData(["messages", convId], (old = []) => {
        const exists = (old || []).some((m) => String(m._id) === String(msg._id));
        if (exists) return old || [];
        return [...(old || []), msg];
      });

      try {
        const activeId = activeConv && activeConv._id ? String(activeConv._id) : null;
        if (activeId && activeId === convId) {
          shouldScrollRef.current = true;
        }
      } catch (e) { }

      // Update conversations list last message
      queryClient.setQueryData(["conversations"], (old = []) =>
        old.map((c) =>
          String(c._id) === convId
            ? {
              ...c,
              lastMessage: {
                content: msg.content || (msg.attachments?.[0]?.type === "image" ? "📷 Photo" : msg.attachments?.[0]?.type === "audio" ? "🎵 Audio" : "📄 File"),
                timestamp: msg.timestamp,
              },
              updatedAt: msg.timestamp,
            }
            : c
        ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );

      // If this message is for a conversation that is NOT currently open,
      // mark that conversation as having unread messages so the chat list
      // can display the green dot. (This also covers the case where the
      // user is on the Messages page but viewing a different conversation.)
      try {
        const activeId = activeConv && activeConv._id ? String(activeConv._id) : null;
        if (!activeId || activeId !== convId) {
          queryClient.setQueryData(["conversations"], (old = []) =>
            old.map((c) => (String(c._id) === convId ? { ...c, _hasUnread: true } : c))
          );
        }
      } catch (e) { }

      // If this message belongs to the currently open conversation, and it's
      // from the other user, immediately mark it as seen on the server so the
      // sender receives the seen update without waiting for a manual reopen.
      try {
        const activeId = activeConv && activeConv._id ? String(activeConv._id) : null;
        const senderId = msg.sender_id && (msg.sender_id._id || msg.sender_id);
        if (activeId && activeId === convId && senderId && String(senderId) !== String(myId)) {
          socket.emit("message-seen", { conversationId: convId });
        }
      } catch (e) { /* ignore */ }
    };
    /* message-status: update status field of a specific message */
    const onStatus = ({ messageId, status }) => {
      queryClient.setQueryData(["messages", activeConv?._id], (old = []) => {
        return (old || []).map((m) => (String(m._id) === String(messageId) ? { ...m, status } : m));
      });
    };

    /* messages-seen: update multiple messages to "seen" */
    const onSeen = ({ conversationId, messageIds }) => {
      queryClient.setQueryData(["messages", conversationId], (old = []) => {
        const ids = messageIds.map(String);
        return (old || []).map((m) => (ids.includes(String(m._id)) ? { ...m, status: "seen" } : m));
      });
    };

    /* message-deleted: remove from cache */
    const onDeleted = ({ messageId, conversationId }) => {
      queryClient.setQueryData(["messages", conversationId], (old = []) => {
        return (old || []).filter((m) => String(m._id) !== String(messageId));
      });
    };

    /* presence */
    const onOnline = ({ userId }) =>
      setOnlineUsers((prev) => new Set([...prev, String(userId)]));
    const onOffline = ({ userId }) =>
      setOnlineUsers((prev) => {
        const s = new Set(prev);
        s.delete(String(userId));
        return s;
      });

    /* new conversation created for me (recipient) — add to conversations */
    const onConversationCreated = ({ conversation }) => {
      if (!conversation) return;
      // Insert at top if not present
      queryClient.setQueryData(["conversations"], (old = []) => {
        const exists = old.some((c) => String(c._id) === String(conversation._id));
        const merged = exists
          ? old.map((c) => (String(c._id) === String(conversation._id) ? { ...c, ...conversation } : c))
          : [conversation, ...old];
        return merged.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });

      // If user currently has a temporary DM open with this otherUserId,
      // attach the real conversation id so messages will load and UI will show it.
      try {
        if (activeConv && !activeConv._id && String(activeConv.otherUserId) === String(conversation.otherUserId)) {
          setActiveConv((prev) => ({ ...(prev || {}), _id: conversation._id }));
          // refresh conversations to populate names/metadata
          refetchConvs();
        }
      } catch (e) { /* ignore */ }
    };

    /* typing */
    const onTyping = ({ conversationId }) =>
      setTypingUsers((prev) => ({ ...prev, [conversationId]: true }));
    const onStopTyping = ({ conversationId }) =>
      setTypingUsers((prev) => ({ ...prev, [conversationId]: false }));

    socket.on("receive-message", onReceive);
    socket.on("message-status", onStatus);
    socket.on("messages-seen", onSeen);
    socket.on("message-deleted", onDeleted);
    socket.on("user-online", onOnline);
    socket.on("user-offline", onOffline);
    socket.on("typing", onTyping);
    socket.on("stop-typing", onStopTyping);
    socket.on("conversation-created", onConversationCreated);

    return () => {
      socket.off("receive-message", onReceive);
      socket.off("message-status", onStatus);
      socket.off("messages-seen", onSeen);
      socket.off("message-deleted", onDeleted);
      socket.off("user-online", onOnline);
      socket.off("user-offline", onOffline);
      socket.off("typing", onTyping);
      socket.off("stop-typing", onStopTyping);
      socket.off("conversation-created", onConversationCreated);
    };
  }, [queryClient, activeConv?._id]);

  // Group conversations deprecated — no room joins required.

  /* ────────── Select conversation ────────── */
  const handleSelectConv = useCallback((conv) => {
    setActiveConv(conv);
    if (isMobile) setMobileView("chat");
  }, [isMobile]);

  /* ────────── Select user from search → open DM (do NOT create DB conv yet) ────────── */
  const handleSelectUser = useCallback(async (user) => {
    if (isAdmin) return;
    try {
      // Don't call the server to create the conversation yet. Open a temporary
      // direct-chat UI so the user can type — the conversation will be created
      // on first message send.
      const conv = {
        // no _id yet — indicates a local-only conversation
        type: "direct",
        name: user.fullName || user.name || "",
        username: user.username,
        otherUserId: user._id,
        lastMessage: { content: "" },
        updatedAt: new Date().toISOString(),
      };
      setActiveConv(conv);
      // Keep conversation list unchanged; when a real conversation is created
      // we will refetch conversations (server will emit receive-message).
      setIsSearchMode(false);
      setSearchQuery("");
    } catch (err) { }
  }, [isAdmin, refetchConvs]);

  const syncTextareaHeight = useCallback(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, []);

  /* ────────── Typing indicator emission ────────── */
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    // Auto-resize
    syncTextareaHeight();

    if (!activeConv) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", {
        conversationId: activeConv._id,
        receiverId: activeConv.otherUserId,
      });
    }

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("stop-typing", {
        conversationId: activeConv._id,
        receiverId: activeConv.otherUserId,
      });
    }, 1500);
  };

  const handleEmojiSelect = useCallback((emojiData) => {
    const emoji = emojiData?.emoji || "";
    if (!emoji) return;

    setInputText((prev) => `${prev}${emoji}`);
    window.setTimeout(() => {
      syncTextareaHeight();
      textareaRef.current?.focus();
    }, 0);
  }, [syncTextareaHeight]);

  /* close header menu on outside click */
  useEffect(() => {
    if (!headerMenuOpen) return;
    const handler = (e) => {
      const t = e.target;
      if (
        headerMenuRef.current && headerMenuRef.current.contains(t)
      ) {
        return;
      }
      if (
        headerMenuButtonRef.current && headerMenuButtonRef.current.contains(t)
      ) {
        return;
      }
      setHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [headerMenuOpen]);

  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = (e) => {
      const t = e.target;
      if (attachMenuRef.current && attachMenuRef.current.contains(t)) return;
      if (attachButtonRef.current && attachButtonRef.current.contains(t)) return;
      setShowAttachMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAttachMenu]);

  useEffect(() => {
    if (!isMobile) {
      setShowAttachMenu(false);
    }
  }, [isMobile]);

  /* ────────── File upload ────────── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset input
    setShowAttachMenu(false);

    const MAX = 10 * 1024 * 1024;
    if (file.size > MAX) {
      alert("File too large. Maximum size is 10 MB.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/upload`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || "Upload failed");
        return;
      }
      const data = await res.json();
      setAttachmentPending({
        url: data.url,
        fileName: data.fileName,
        fileType: data.fileType,
        size: data.size,
      });
    } catch (err) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* ────────── Send message ────────── */
  const handleSend = useCallback(() => {
    if (!activeConv) return;
    if (!inputText.trim() && !attachmentPending) return;
    setShowAttachMenu(false);

    const attachments = attachmentPending
      ? [
        {
          type: attachmentPending.fileType,
          url: attachmentPending.url,
          fileName: attachmentPending.fileName,
          size: attachmentPending.size,
        },
      ]
      : [];

    const payload = {
      conversationId: activeConv?._id,
      content: inputText.trim(),
      attachments,
      receiverId: activeConv?.otherUserId || undefined,
    };

    shouldScrollRef.current = true;

    // If the last message has a different date than now, show a temporary
    // date separator immediately so the user sees the day divider before
    // the server ack arrives. This is a client-only UI helper; the real
    // separator will be derived from server timestamps after refresh.
    try {
      const convId = activeConv._id ? String(activeConv._id) : "pending-" + String(activeConv.otherUserId || "");
      const lastMsg = messages && messages.length ? messages[messages.length - 1] : null;
      const lastDate = lastMsg ? stripDate(lastMsg.timestamp) : null;
      const nowDate = stripDate(Date.now());
      if (lastDate !== nowDate) {
        setManualSeparators((prev) => {
          const copy = { ...(prev || {}) };
          const set = new Set(copy[convId] ? Array.from(copy[convId]) : []);
          set.add(nowDate);
          copy[convId] = set;
          return copy;
        });
      }
    } catch (e) { }
    socket.emit("send-message", payload, (response) => {
      if (response?.error) {
        showNotification("Message could not be sent", "error");
        return;
      }

      // If the server created a conversation (first message), it will return
      // the new conversationId alongside the message. Use that when updating
      // caches and active conversation state.
      const convId = response?.conversationId || activeConv?._id;
      if (response?.message) {
        if (convId) {
          // ensure activeConv has the real _id if it was created
          if (!activeConv?._id) setActiveConv((prev) => ({ ...(prev || {}), _id: convId }));

          queryClient.setQueryData(["messages", convId], (old = []) => {
            const exists = (old || []).some((m) => String(m._id) === String(response.message._id));
            if (exists) return old || [];
            return [...(old || []), response.message];
          });

          // Refresh conversations list so the new conversation appears
          refetchConvs();

          // Clear any manual separator we added for this conv + date
          try {
            const nowDate = stripDate(response.message.timestamp || Date.now());
            setManualSeparators((prev) => {
              if (!prev) return prev;
              const copy = { ...prev };
              const set = copy[convId] ? new Set(Array.from(copy[convId])) : null;
              if (set && set.has(nowDate)) {
                set.delete(nowDate);
                if (set.size === 0) delete copy[convId];
                else copy[convId] = set;
              }
              return copy;
            });
          } catch (e) { }
        }
      }
    });

    setInputText("");
    setShowEmojiPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setAttachmentPending(null);
    clearTimeout(typingTimer.current);
    setIsTyping(false);
    socket.emit("stop-typing", {
      conversationId: activeConv._id,
      receiverId: activeConv.otherUserId,
    });
  }, [activeConv, inputText, attachmentPending, queryClient]);

  /* ────────── Delete message ────────── */
  const handleDelete = useCallback(
    (messageId) => {
      if (!activeConv) return;
      try {
        queryClient.setQueryData(["messages", activeConv._id], (old = []) => {
          return (old || []).filter((m) => String(m._id) !== String(messageId));
        });
      } catch (e) { }

      socket.emit(
        "delete-message",
        {
          messageId,
          conversationId: activeConv._id,
        },
        (res) => {
          if (res && res.error) {
            showNotification("Delete failed", "error");
          } else {
            showNotification("Message deleted", "success");
          }
        }
      );
    },
    [activeConv]
  );

  const showNotification = (msg, type = "info", duration = 2500) => {
    setNotification({ open: true, message: msg, type, closing: false });
    window.setTimeout(() => {
      setNotification((s) => ({ ...s, closing: true }));
      window.setTimeout(() => setNotification({ open: false, message: "", type: "info", closing: false }), 300);
    }, duration);
  };

  /* ────────── Find the index of the last sent message (for status display) ────────── */
  const lastSentIdx = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => String(m.sender_id?._id || m.sender_id) === String(myId))
    .pop()?.i;

  /* ════ RENDER ════ */
  // If navigated here with an openConversationId OR openConversationOtherUserId,
  // open the conversation (or a temporary DM) once conversations are loaded.
  useEffect(() => {
    try {
      const openId = location && location.state && (location.state.openConversationId || location.state.openConversation);
      const openOtherUserId = location && location.state && location.state.openConversationOtherUserId;
      const requestKey = `${location.key || "messages"}:${openId || ""}:${openOtherUserId || ""}`;

      if (!openId && !openOtherUserId) {
        handledRouteOpenRef.current = "";
        return;
      }

      if (handledRouteOpenRef.current === requestKey) {
        return;
      }

      const finalizeRouteOpen = (conversation) => {
        handledRouteOpenRef.current = requestKey;
        setActiveConv(conversation);
        navigate("/home/messages", { replace: true });
      };

      if (openId) {
        if (conversations && conversations.length > 0) {
          const found = conversations.find((c) => String(c._id) === String(openId));
          if (found) {
            finalizeRouteOpen(found);
            return;
          }
        }
        // If not found yet, refetch conversations and try to open
        refetchConvs().then(() => {
          const list = queryClient.getQueryData(["conversations"]) || [];
          const f = list.find((c) => String(c._id) === String(openId));
          if (f) finalizeRouteOpen(f);
        }).catch(() => { });
        return;
      }

      if (openOtherUserId) {
        // Try to find an existing conversation with this other user
        if (conversations && conversations.length > 0) {
          const found = conversations.find((c) => String(c.otherUserId) === String(openOtherUserId));
          if (found) {
            finalizeRouteOpen(found);
            return;
          }
        }

        // Not found — open a temporary DM (no _id) so the user can type.
        const tempName = (location.state && location.state.openConversationOtherUserName) || "";
        const conv = {
          type: "direct",
          name: tempName,
          username: "",
          otherUserId: openOtherUserId,
          lastMessage: { content: "" },
          updatedAt: new Date().toISOString(),
        };
        finalizeRouteOpen(conv);
        return;
      }
    } catch (e) { }
  }, [conversations, location.key, location.state, refetchConvs, queryClient, navigate]);

  const showList = !isMobile || mobileView !== "chat";
  const showChat = !isMobile || mobileView !== "list";

  return (
    <div className={`msg-page ${isMobile ? "msg-page-mobile" : ""}`}>
      {notification.open && (
        <MessageBox message={notification.message} type={notification.type} closing={notification.closing} />
      )}
      {imageModal.open && (
        <div className="msg-image-modal" onClick={() => setImageModal({ open: false, url: '', fileName: '' })}>
          <button className="msg-image-modal-back" onClick={(e) => { e.stopPropagation(); setImageModal({ open: false, url: '', fileName: '' }); }}>Back</button>
          <img className="msg-image-modal-image" onClick={(e) => e.stopPropagation()} src={imageModal.url} alt={imageModal.fileName || 'image'} />
        </div>
      )}
      {/* ═══════════ LEFT PANEL ═══════════ */}
      {showList && (
      <div className="msg-left-panel">
        <div className="msg-panel-header">
          <h2>{isAdmin ? "User Reports" : "Messages"}</h2>
          <p>
            {conversations.length} {isAdmin ? "user" : "conversation"}
            {conversations.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isSearchMode && !isAdmin ? (
          /* ─── Search Mode ─── */
          <div className="msg-search-panel">
            <div className="msg-search-header">
              <button
                className="msg-search-back-btn"
                onClick={() => {
                  setIsSearchMode(false);
                  setSearchQuery("");
                }}
              >
                <BackArrowIcon />
              </button>
              <div className="msg-search-input-wrap">
                <SearchIcon />
                <input
                  className="msg-search-input"
                  placeholder="Search by username…"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      padding: 0,
                    }}
                    onClick={() => setSearchQuery("")}
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            </div>

            <div className="msg-search-results">
              {!searchQuery && (
                <div className="msg-search-empty">
                  <SearchIcon />
                  <p>Search for a user to start chatting</p>
                </div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <div className="msg-search-empty">
                  <p>No users found for "{searchQuery}"</p>
                </div>
              )}
              {searchResults.map((user) => (
                <div
                  key={user._id}
                  className="msg-chat-item"
                  onClick={() => handleSelectUser(user)}
                >
                  <Avatar name={user.fullName} />
                  <div className="msg-chat-info">
                    <div className="msg-chat-name">{user.fullName}</div>
                    <div className="msg-chat-preview">
                      @{user.username} · {user.role}
                    </div>
                  </div>
                  <span
                    style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600 }}
                  >
                    Chat
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ─── Chat List ─── */
          <>
            <div className="msg-chat-list">
              {conversations.map((conv) => (
                <ChatItem
                  key={conv._id}
                  conv={conv}
                  isActive={activeConv?._id === conv._id}
                  onClick={handleSelectConv}
                  onlineUsers={onlineUsers}
                  typingUsers={typingUsers}
                />
              ))}
              {conversations.length === 0 && (
                <div className="msg-search-empty">
                  <p>{isAdmin ? "User reports will appear here." : "No conversations yet. Start one!"}</p>
                </div>
              )}
            </div>

            {/* Floating New Chat Button */}
            {!isAdmin && (
              <button
                className="msg-new-chat-btn"
                onClick={() => setIsSearchMode(true)}
                title="New Chat"
              >
                <PenIcon />
              </button>
            )}
          </>
        )}
      </div>
      )}

      {/* ═══════════ RIGHT PANEL ═══════════ */}
      {showChat && (
      <div className="msg-right-panel">
        {!activeConv ? (
            <div className="msg-empty-state">
              <div className="empty-icon">
                <ChatBubbleIcon />
              </div>
            <h3>{isAdmin ? "User Reports" : "Your Messages"}</h3>
            <p>{isAdmin ? "Select a user to review admin reports." : "Select a conversation or start a new one"}</p>
          </div>
        ) : (
          <>
            {/* ─── Header ─── */}
            <div className="msg-conv-header">
              {isMobile && (
                <button
                  className="msg-mobile-back"
                  aria-label="Back to conversations"
                  onClick={() => {
                    setActiveConv(null);
                    setMobileView("list");
                  }}
                >
                  <BackArrowIcon />
                </button>
              )}
              <Avatar name={activeConv.name} size={40} />
              <div className="header-info">
                <div className="header-name">{activeConv.name}</div>
                <div className="header-status">
                  {activeConv.type === "group"
                    ? "Group Chat"
                    : onlineUsers.has(String(activeConv.otherUserId))
                      ? "● Online"
                      : ""}
                </div>
              </div>
              <div className="header-actions">
                <button
                  className="msg-icon-btn"
                  title="More options"
                  onClick={() => setHeaderMenuOpen((v) => !v)}
                  ref={headerMenuButtonRef}
                >
                  <DotsIcon />
                </button>
                {headerMenuOpen && (
                  <div className="msg-conv-menu" ref={headerMenuRef}>
                    <button
                      className="msg-conv-menu-item"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setActiveConv(null);
                      }}
                    >
                      Close Chat
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Messages Area ─── */}
            <div className="msg-messages-area">


              {
                (() => {
                  const nodes = [];
                  let prevDate = null;
                  for (let i = 0; i < messages.length; i++) {
                    const msg = messages[i];
                    const curDate = stripDate(msg.timestamp);
                    if (curDate !== prevDate) {
                      nodes.push(
                        <DateSeparator key={`sep-${curDate}-${i}`} label={formatDateLabel(msg.timestamp)} />
                      );
                    }
                    const isSent = String(msg.sender_id?._id || msg.sender_id) === String(myId);
                    nodes.push(
                      <MessageRow
                        key={msg._id}
                        msg={msg}
                        isSent={isSent}
                        myId={myId}
                        onDelete={handleDelete}
                        isLastSent={isSent && i === lastSentIdx}
                        showNotification={showNotification}
                      />
                    );
                    prevDate = curDate;
                  }

                  // If user added a separator client-side (while sending) but the
                  // optimistic message hasn't been persisted yet, render that
                  // manual separator at the end so it appears immediately.
                  try {
                    const convId = activeConv && activeConv._id ? String(activeConv._id) : "pending-" + String(activeConv?.otherUserId || "");
                    const manual = manualSeparators && manualSeparators[convId];
                    if (manual && manual instanceof Set) {
                      for (const dateStr of Array.from(manual)) {
                        // only render if it's not already the prevDate
                        if (dateStr !== prevDate) {
                          const dt = new Date(dateStr);
                          nodes.push(
                            <DateSeparator key={`manual-${dateStr}`} label={formatDateLabel(dt)} />
                          );
                        }
                      }
                    }
                  } catch (e) { }

                  return nodes;
                })()
              }

              {/* Typing indicator */}
              {typingUsers[activeConv._id] && (
                <div className="msg-row received">
                  <div className="msg-row-avatar">…</div>
                  <div className="msg-bubble-wrap">
                    <div className="msg-bubble" >
                      <TypingLoader />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ─── Attachment Preview ─── */}
            {attachmentPending && (
              <div
                style={{
                  padding: "6px 16px",
                  background: "var(--surface-accent)",
                  borderTop: "1px solid var(--border-accent)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                {attachmentPending.fileType === "image" ? (
                  <>
                    <img
                      src={attachmentPending.url}
                      alt="preview"
                      style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }}
                    />
                    {attachmentPending.fileName}
                  </>
                ) : (
                  <>
                    <DocIcon />
                    {attachmentPending.fileName}
                  </>
                )}
                <button
                  onClick={() => setAttachmentPending(null)}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}
                >
                  <XIcon />
                </button>
              </div>
            )}

            {/* ─── Input Bar ─── */}
            <div className="msg-input-bar">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".jpg,.jpeg,.png,.webp,.mp3,.pdf,.doc,.docx,.zip"
                onChange={handleFileChange}
              />
              <input
                type="file"
                ref={cameraInputRef}
                style={{ display: "none" }}
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
              />
              <div className="msg-input-compose">
                {showEmojiPicker && (
                  <div className="msg-emoji-popover" ref={emojiPickerRef}>
                    <EmojiPicker
                      onEmojiClick={handleEmojiSelect}
                      theme={emojiTheme}
                      width="100%"
                      height={360}
                      lazyLoadEmojis={true}
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}
                <div className="msg-input-wrap">
                  <button
                    ref={emojiButtonRef}
                    className="msg-emoji-btn"
                    title="Emoji"
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                  >
                    <EmojiIcon />
                  </button>
                <textarea
                  ref={textareaRef}
                  placeholder={uploading ? "Uploading…" : "Type a message…"}
                  value={inputText}
                  disabled={uploading}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  className="msg-input-field"
                />
                <button
                  className="msg-attach-btn"
                  title="Attach file"
                  type="button"
                  ref={attachButtonRef}
                  onClick={() => {
                    if (isMobile) {
                      setShowAttachMenu((prev) => !prev);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  disabled={uploading}
                >
                  <AttachIcon />
                </button>
              </div>
              {isMobile && showAttachMenu && (
                <div className="msg-attach-sheet" ref={attachMenuRef}>
                  <button
                    type="button"
                    className="msg-attach-option"
                    onClick={() => {
                      setShowAttachMenu(false);
                      cameraInputRef.current?.click();
                    }}
                  >
                    <CameraIcon />
                    <span>Camera</span>
                  </button>
                  <button
                    type="button"
                    className="msg-attach-option"
                    onClick={() => {
                      setShowAttachMenu(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <AttachIcon />
                    <span>Files</span>
                  </button>
                </div>
              )}
              </div>
              <button
                className="msg-send-btn"
                onClick={handleSend}
                title="Send"
                disabled={!inputText.trim() && !attachmentPending}
              >
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
};

/* ─────────────── SVG ICONS (unchanged from UI version) ─────────────── */
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const VolumeIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const MuteIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);

const DownArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
    <path d="M7 10l5 5 5-5z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
  </svg>
);

const DocIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const BackArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const PenIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

const EmojiIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
  </svg>
);

const AttachIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M9 4l1.5-2h3L15 4h3c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h3zm3 13a4 4 0 100-8 4 4 0 000 8zm0-1.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
  </svg>
);

const ChatBubbleIcon = () => (
  <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
  </svg>
);

const DotsIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

export default Messages;
